begin;

alter table private.relic_server_config
  add column if not exists collection_challenge_ttl_seconds integer not null default 90
    check (collection_challenge_ttl_seconds between 30 and 300),
  add column if not exists proximity_sample_freshness_seconds integer not null default 30
    check (proximity_sample_freshness_seconds between 10 and 120);

alter table private.one_time_collection_challenges
  add column if not exists reveal_attempt_id uuid
    references private.location_verification_attempts(id) on delete set null;

create index if not exists one_time_challenges_reveal_attempt_idx
  on private.one_time_collection_challenges (reveal_attempt_id);

-- Locked candidates are still assigned as anonymous anomalies. The safe field
-- response labels them locked but never says Rare/Legendary or exposes identity.
create or replace function public.server_assign_relic_candidate(
  p_user_id uuid,
  p_zone_id uuid,
  p_candidate_id uuid,
  p_mystery_latitude double precision,
  p_mystery_longitude double precision,
  p_mystery_radius_meters double precision,
  p_clue_distance_band_meters integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate private.relic_spawn_candidates%rowtype;
  v_window private.relic_spawn_windows%rowtype;
  v_rare_eligible boolean;
  v_legendary_eligible boolean;
  v_override boolean;
  v_assignment_id uuid;
  v_eligibility_status text;
begin
  select * into strict v_candidate
  from private.relic_spawn_candidates
  where id = p_candidate_id and status = 'available';

  select * into strict v_window
  from private.relic_spawn_windows
  where id = v_candidate.spawn_window_id;

  select * into v_rare_eligible, v_legendary_eligible, v_override
  from public.server_get_daily_eligibility(p_user_id);

  v_eligibility_status := case
    when v_candidate.rarity = 'rare' and not v_rare_eligible then 'locked'
    when v_candidate.rarity = 'legendary' and not v_legendary_eligible then 'locked'
    when v_override and v_candidate.rarity in ('rare', 'legendary') then 'overridden'
    else 'eligible'
  end;

  insert into private.user_relic_assignments (
    user_id, exploration_zone_id, spawn_candidate_id, relic_id, rarity,
    eligibility_status, mystery_center, mystery_radius_meters,
    clue_distance_band_meters, expires_at, grace_ends_at
  ) values (
    p_user_id, p_zone_id, p_candidate_id, v_candidate.relic_id, v_candidate.rarity,
    v_eligibility_status,
    extensions.st_setsrid(extensions.st_makepoint(p_mystery_longitude, p_mystery_latitude), 4326)::extensions.geography,
    p_mystery_radius_meters, p_clue_distance_band_meters,
    v_window.ends_at, v_window.grace_ends_at
  )
  on conflict (user_id, spawn_candidate_id) do update
    set updated_at = excluded.updated_at
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

drop function if exists public.server_list_client_mystery_zones(uuid, uuid);
create function public.server_list_client_mystery_zones(
  p_user_id uuid,
  p_zone_id uuid
)
returns table (
  assignment_id uuid,
  mystery_latitude double precision,
  mystery_longitude double precision,
  mystery_radius_meters double precision,
  clue_distance_band_meters integer,
  status text,
  availability_status text,
  expires_at timestamptz,
  grace_ends_at timestamptz,
  safety_status text,
  safety_limitation text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    assignment.id,
    extensions.st_y(assignment.mystery_center::extensions.geometry),
    extensions.st_x(assignment.mystery_center::extensions.geometry),
    assignment.mystery_radius_meters::double precision,
    assignment.clue_distance_band_meters,
    assignment.status,
    case when assignment.eligibility_status = 'locked' then 'locked' else 'available' end,
    assignment.expires_at,
    assignment.grace_ends_at,
    candidate.safety_status,
    candidate.safety_limitation
  from private.user_relic_assignments as assignment
  join private.relic_spawn_candidates as candidate on candidate.id = assignment.spawn_candidate_id
  where assignment.user_id = p_user_id
    and assignment.exploration_zone_id = p_zone_id
    and assignment.status in ('active', 'verification', 'revealed')
    and private.assignment_is_active(
      assignment.expires_at, assignment.grace_ends_at,
      assignment.verification_started_at, clock_timestamp()
    )
  order by assignment.assigned_at;
$$;

create or replace function public.server_get_proximity_context(
  p_user_id uuid,
  p_assignment_id uuid
)
returns table (
  assignment_status text,
  active boolean,
  eligible boolean,
  already_collected boolean,
  exact_latitude double precision,
  exact_longitude double precision,
  rarity text,
  expires_at timestamptz,
  grace_ends_at timestamptz,
  verification_started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.user_relic_assignments%rowtype;
  v_rare boolean;
  v_legendary boolean;
begin
  select * into strict v_assignment
  from private.user_relic_assignments
  where id = p_assignment_id and user_id = p_user_id
  for update;

  -- The grace clock starts atomically on the first server verification request,
  -- never from a client timestamp and never after the normal expiry moment.
  if v_assignment.verification_started_at is null
    and v_assignment.status = 'active'
    and clock_timestamp() < v_assignment.expires_at then
    v_assignment.verification_started_at := clock_timestamp();
    v_assignment.status := 'verification';
    update private.user_relic_assignments
    set verification_started_at = v_assignment.verification_started_at,
        status = 'verification', updated_at = clock_timestamp()
    where id = p_assignment_id;
  end if;

  select eligibility.rare_eligible, eligibility.legendary_eligible
  into v_rare, v_legendary
  from public.server_get_daily_eligibility(p_user_id) as eligibility;

  return query select
    v_assignment.status,
    private.assignment_is_active(
      v_assignment.expires_at, v_assignment.grace_ends_at,
      v_assignment.verification_started_at, clock_timestamp()
    ),
    case
      when v_assignment.rarity = 'rare' then v_rare
      when v_assignment.rarity = 'legendary' then v_legendary
      else true
    end,
    exists (
      select 1 from public.user_relic_collections as collection
      where collection.user_id = p_user_id and collection.assignment_id = p_assignment_id
    ),
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry),
    v_assignment.rarity,
    v_assignment.expires_at,
    v_assignment.grace_ends_at,
    v_assignment.verification_started_at
  from private.relic_spawn_candidates as candidate
  where candidate.id = v_assignment.spawn_candidate_id;
end;
$$;

create or replace function public.server_record_proximity_attempt(
  p_user_id uuid,
  p_assignment_id uuid,
  p_purpose text,
  p_payload_digest text,
  p_result_status text,
  p_reading_count integer,
  p_maximum_accuracy_meters double precision,
  p_median_latitude double precision,
  p_median_longitude double precision,
  p_measured_distance_meters double precision,
  p_radius_used_meters double precision,
  p_rejection_code text
)
returns table (attempt_id uuid, replayed boolean, accepted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.user_relic_assignments%rowtype;
  v_attempt_id uuid;
  v_replayed boolean := false;
  v_config private.relic_server_config%rowtype;
  v_result_status text := p_result_status;
  v_effective_rejection_code text := p_rejection_code;
  v_attempt_status text;
begin
  select * into strict v_assignment
  from private.user_relic_assignments
  where id = p_assignment_id and user_id = p_user_id
  for update;
  select * into strict v_config from private.relic_server_config where singleton;

  if p_purpose = 'collection' and exists (
    select 1 from private.location_verification_attempts as reveal_attempt
    where reveal_attempt.user_id = p_user_id
      and reveal_attempt.assignment_id = p_assignment_id
      and reveal_attempt.purpose = 'reveal'
      and reveal_attempt.payload_digest = p_payload_digest
  ) then
    v_result_status := 'invalid_movement';
    v_effective_rejection_code := 'REPLAYED_SAMPLES';
  end if;

  if p_purpose = 'reveal'
    and v_assignment.verification_started_at is null
    and clock_timestamp() < v_assignment.expires_at then
    update private.user_relic_assignments
    set status = 'verification', verification_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = p_assignment_id;
  end if;

  insert into private.location_verification_attempts (
    user_id, assignment_id, purpose, status, accurate_reading_count,
    maximum_accuracy_meters, median_point, measured_distance_meters,
    radius_used_meters, rejection_code, payload_digest, verified_at, retained_until
  ) values (
    p_user_id, p_assignment_id, p_purpose,
    case when v_result_status = 'revealed' then 'verified' else 'rejected' end,
    p_reading_count, p_maximum_accuracy_meters,
    case when p_median_latitude is null or p_median_longitude is null then null else
      extensions.st_setsrid(extensions.st_makepoint(p_median_longitude, p_median_latitude), 4326)::extensions.geography end,
    p_measured_distance_meters, p_radius_used_meters,
    coalesce(v_effective_rejection_code, case when v_result_status <> 'revealed' then v_result_status end),
    p_payload_digest,
    case when v_result_status = 'revealed' then clock_timestamp() end,
    clock_timestamp() + (v_config.location_retention_hours || ' hours')::interval
  )
  on conflict (user_id, purpose, payload_digest) do nothing
  returning id into v_attempt_id;

  if v_attempt_id is null then
    v_replayed := true;
    select id, status into strict v_attempt_id, v_attempt_status
    from private.location_verification_attempts
    where user_id = p_user_id and purpose = p_purpose and payload_digest = p_payload_digest;
  else
    v_attempt_status := case when v_result_status = 'revealed' then 'verified' else 'rejected' end;
  end if;

  if p_purpose = 'reveal' and v_result_status = 'revealed' then
    update private.user_relic_assignments
    set status = 'revealed', revealed_at = coalesce(revealed_at, clock_timestamp()), updated_at = clock_timestamp()
    where id = p_assignment_id and status in ('active', 'verification', 'revealed');
  end if;

  return query select v_attempt_id, v_replayed, v_attempt_status = 'verified';
end;
$$;

create or replace function public.server_issue_collection_challenge(
  p_user_id uuid,
  p_assignment_id uuid,
  p_reveal_attempt_id uuid,
  p_device_installation_id text,
  p_token_hash text
)
returns table (challenge_id uuid, expires_at timestamptz, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.one_time_collection_challenges%rowtype;
  v_ttl integer;
begin
  if not exists (
    select 1 from private.location_verification_attempts as attempt
    where attempt.id = p_reveal_attempt_id and attempt.user_id = p_user_id
      and attempt.assignment_id = p_assignment_id
      and attempt.purpose = 'reveal' and attempt.status = 'verified'
  ) then raise exception using errcode = 'P0001', message = 'Reveal verification is unavailable'; end if;

  if not exists (
    select 1 from private.user_relic_assignments as assignment
    where assignment.id = p_assignment_id and assignment.user_id = p_user_id
      and assignment.status = 'revealed'
  ) then raise exception using errcode = 'P0001', message = 'Relic is unavailable'; end if;

  select collection_challenge_ttl_seconds into strict v_ttl
  from private.relic_server_config where singleton;

  insert into private.one_time_collection_challenges (
    user_id, assignment_id, reveal_attempt_id, device_installation_id,
    purpose, token_hash, expires_at
  ) values (
    p_user_id, p_assignment_id, p_reveal_attempt_id, p_device_installation_id,
    'collection', p_token_hash, clock_timestamp() + make_interval(secs => v_ttl)
  )
  on conflict (token_hash) do nothing
  returning * into v_challenge;

  if not found then
    select * into strict v_challenge
    from private.one_time_collection_challenges where token_hash = p_token_hash;
  end if;

  return query select v_challenge.id, v_challenge.expires_at, v_challenge.status;
end;
$$;

create or replace function public.server_get_revealed_relic_metadata(
  p_user_id uuid,
  p_assignment_id uuid
)
returns table (relic_id text, display_name text, rarity text, xp_reward integer)
language sql
security definer
stable
set search_path = ''
as $$
  select catalog.relic_id, catalog.display_name, catalog.rarity, catalog.xp_reward
  from private.user_relic_assignments as assignment
  join public.relic_catalog as catalog on catalog.relic_id = assignment.relic_id
  where assignment.id = p_assignment_id and assignment.user_id = p_user_id
    and assignment.status in ('revealed', 'collected');
$$;

create or replace function public.server_complete_relic_collection(
  p_user_id uuid,
  p_assignment_id uuid,
  p_challenge_token_hash text,
  p_verification_attempt_id uuid
)
returns table (
  collection_id uuid,
  relic_id text,
  xp_awarded integer,
  collected_at timestamptz,
  was_new_collection boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.user_relic_assignments%rowtype;
  v_challenge private.one_time_collection_challenges%rowtype;
  v_attempt private.location_verification_attempts%rowtype;
  v_collection public.user_relic_collections%rowtype;
  v_config private.relic_server_config%rowtype;
  v_rare boolean;
  v_legendary boolean;
  v_xp integer;
  v_was_new boolean := false;
begin
  select * into strict v_assignment
  from private.user_relic_assignments
  where id = p_assignment_id and user_id = p_user_id
  for update;

  select * into strict v_challenge
  from private.one_time_collection_challenges
  where user_id = p_user_id and assignment_id = p_assignment_id
    and purpose = 'collection' and token_hash = p_challenge_token_hash
  for update;

  -- A lost success response can safely retry the same challenge. It returns the
  -- existing collection but cannot award XP again.
  if v_challenge.status = 'used' then
    select * into v_collection from public.user_relic_collections
    where user_id = p_user_id and assignment_id = p_assignment_id;
    if found then
      return query select v_collection.id, v_collection.relic_id,
        v_collection.xp_awarded, v_collection.collected_at, false;
      return;
    end if;
    raise exception using errcode = 'P0001', message = 'Collection challenge is unavailable';
  end if;

  if v_challenge.status <> 'issued' or v_challenge.expires_at < clock_timestamp() then
    update private.one_time_collection_challenges set status = 'expired'
    where id = v_challenge.id and status = 'issued';
    raise exception using errcode = 'P0001', message = 'Collection challenge expired';
  end if;

  if not private.assignment_is_active(
    v_assignment.expires_at, v_assignment.grace_ends_at,
    v_assignment.verification_started_at, clock_timestamp()
  ) then raise exception using errcode = 'P0001', message = 'Collection expired'; end if;

  select eligibility.rare_eligible, eligibility.legendary_eligible
  into v_rare, v_legendary
  from public.server_get_daily_eligibility(p_user_id) as eligibility;
  if (v_assignment.rarity = 'rare' and not v_rare)
    or (v_assignment.rarity = 'legendary' and not v_legendary) then
    raise exception using errcode = 'P0001', message = 'Collection is ineligible';
  end if;

  select * into strict v_attempt
  from private.location_verification_attempts
  where id = p_verification_attempt_id and user_id = p_user_id
    and assignment_id = p_assignment_id and purpose = 'collection';
  select * into strict v_config from private.relic_server_config where singleton;

  if v_attempt.status <> 'verified'
    or v_attempt.verified_at < clock_timestamp() - interval '60 seconds'
    or v_attempt.accurate_reading_count < v_config.required_accurate_readings
    or v_attempt.maximum_accuracy_meters > v_config.max_acceptable_gps_accuracy_meters
    or v_attempt.radius_used_meters > v_config.fallback_reveal_radius_meters then
    raise exception using errcode = 'P0001', message = 'Final location verification failed';
  end if;

  update private.one_time_collection_challenges
  set status = 'used', used_at = clock_timestamp()
  where id = v_challenge.id;

  select catalog.xp_reward into strict v_xp from public.relic_catalog as catalog
  where catalog.relic_id = v_assignment.relic_id and catalog.is_enabled;

  insert into public.user_relic_collections (user_id, assignment_id, relic_id, xp_awarded)
  values (p_user_id, p_assignment_id, v_assignment.relic_id, v_xp)
  on conflict on constraint user_relic_collections_user_id_relic_id_key do nothing
  returning * into v_collection;

  if found then
    v_was_new := true;
    insert into private.xp_ledger (user_id, source_type, source_id, xp_delta)
    values (p_user_id, 'relic_collection', v_collection.id, v_xp)
    on conflict (user_id, source_type, source_id) do nothing;
  else
    select collection.* into strict v_collection
    from public.user_relic_collections as collection
    where collection.user_id = p_user_id and collection.relic_id = v_assignment.relic_id;
  end if;

  update private.user_relic_assignments as assignment
  set status = 'collected', collected_at = coalesce(assignment.collected_at, v_collection.collected_at),
      updated_at = clock_timestamp()
  where assignment.id = p_assignment_id;

  return query select v_collection.id, v_collection.relic_id,
    v_collection.xp_awarded, v_collection.collected_at, v_was_new;
end;
$$;

create or replace function public.server_cleanup_expired_location_data()
returns table (proximity_rows_deleted integer, movement_rows_deleted integer, challenges_expired integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_proximity integer; v_movement integer; v_challenges integer;
begin
  delete from private.location_verification_attempts where retained_until < clock_timestamp();
  get diagnostics v_proximity = row_count;
  delete from private.movement_sample_evidence where retained_until < clock_timestamp();
  get diagnostics v_movement = row_count;
  update private.one_time_collection_challenges set status = 'expired'
  where status = 'issued' and expires_at < clock_timestamp();
  get diagnostics v_challenges = row_count;
  return query select v_proximity, v_movement, v_challenges;
end;
$$;

revoke execute on function public.server_assign_relic_candidate(uuid, uuid, uuid, double precision, double precision, double precision, integer) from public, anon, authenticated;
revoke execute on function public.server_list_client_mystery_zones(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.server_get_proximity_context(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.server_record_proximity_attempt(uuid, uuid, text, text, text, integer, double precision, double precision, double precision, double precision, double precision, text) from public, anon, authenticated;
revoke execute on function public.server_issue_collection_challenge(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.server_get_revealed_relic_metadata(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.server_complete_relic_collection(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.server_cleanup_expired_location_data() from public, anon, authenticated;

grant execute on function public.server_assign_relic_candidate(uuid, uuid, uuid, double precision, double precision, double precision, integer) to service_role;
grant execute on function public.server_list_client_mystery_zones(uuid, uuid) to service_role;
grant execute on function public.server_get_proximity_context(uuid, uuid) to service_role;
grant execute on function public.server_record_proximity_attempt(uuid, uuid, text, text, text, integer, double precision, double precision, double precision, double precision, double precision, text) to service_role;
grant execute on function public.server_issue_collection_challenge(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.server_get_revealed_relic_metadata(uuid, uuid) to service_role;
grant execute on function public.server_complete_relic_collection(uuid, uuid, text, uuid) to service_role;
grant execute on function public.server_cleanup_expired_location_data() to service_role;

comment on function public.server_get_proximity_context(uuid, uuid) is
  'Service-only exact coordinate context. Never call or expose from the Expo client.';
comment on function public.server_complete_relic_collection(uuid, uuid, text, uuid) is
  'Atomic idempotent Vault, XP, challenge consumption, and assignment completion transaction.';

commit;
