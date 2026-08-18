begin;

alter table private.relic_spawn_candidates
  add column spawn_tier text not null default 'regional',
  add column owner_user_id uuid references auth.users(id) on delete cascade;

update private.relic_spawn_candidates
set spawn_tier = case
  when slot_index between 1000 and 1999 then 'ambient'
  when slot_index between 2000 and 2999 then 'neighborhood'
  when slot_index between 3000 and 3999 then 'local'
  else 'regional'
end;

alter table private.relic_spawn_candidates
  add constraint relic_spawn_candidates_spawn_tier_check
    check (spawn_tier in ('ambient', 'neighborhood', 'local', 'regional'));

alter table private.relic_spawn_candidates
  drop constraint if exists relic_spawn_candidates_safety_status_check;
alter table private.relic_spawn_candidates
  add constraint relic_spawn_candidates_safety_status_check
    check (safety_status in ('verified', 'verified_vicinity', 'unverified'));

create unique index relic_spawn_candidates_one_ambient_per_user_window_idx
  on private.relic_spawn_candidates (spawn_window_id, owner_user_id, spawn_tier)
  where spawn_tier = 'ambient' and owner_user_id is not null;

create index relic_spawn_candidates_owner_window_idx
  on private.relic_spawn_candidates (owner_user_id, spawn_window_id, status);

drop function if exists public.server_save_spawn_candidate(
  uuid, integer, text, double precision, double precision, uuid, text, text, text
);
create function public.server_save_spawn_candidate(
  p_spawn_window_id uuid,
  p_slot_index integer,
  p_relic_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_safe_location_id uuid,
  p_safety_status text,
  p_safety_limitation text,
  p_seed_digest text,
  p_spawn_tier text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_rarity text;
begin
  if p_spawn_tier not in ('neighborhood', 'local', 'regional') then
    raise exception using errcode = '22023', message = 'Invalid shared spawn tier';
  end if;

  select rarity into strict v_rarity
  from public.relic_catalog
  where relic_id = p_relic_id and is_enabled;

  insert into private.relic_spawn_candidates (
    spawn_window_id, slot_index, relic_id, rarity, exact_point,
    safe_location_id, safety_status, safety_limitation, seed_digest, spawn_tier
  ) values (
    p_spawn_window_id, p_slot_index, p_relic_id, v_rarity,
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude), 4326
    )::extensions.geography,
    p_safe_location_id, p_safety_status, p_safety_limitation, p_seed_digest,
    p_spawn_tier
  )
  on conflict (spawn_window_id, slot_index) do update
    set updated_at = excluded.updated_at
  returning id into v_candidate_id;

  return v_candidate_id;
end;
$$;

create function public.server_save_ambient_spawn_candidate(
  p_user_id uuid,
  p_spawn_window_id uuid,
  p_relic_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_seed_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_rarity text;
  v_slot_index integer;
  v_exact_point extensions.geography(Point, 4326);
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'Invalid ambient point';
  end if;

  v_exact_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude), 4326
  )::extensions.geography;

  if not exists (
    select 1
    from private.location_verification_attempts as attempt
    where attempt.user_id = p_user_id
      and attempt.purpose = 'zone_anchor'
      and attempt.status = 'verified'
      and attempt.verified_at > clock_timestamp() - interval '60 seconds'
      and attempt.median_point is not null
      and extensions.st_dwithin(attempt.median_point, v_exact_point, 2)
  ) then
    raise exception using errcode = '22023', message = 'Ambient point lacks a fresh verified anchor';
  end if;

  if not exists (
    select 1 from private.relic_spawn_windows as spawn_window
    where spawn_window.id = p_spawn_window_id
      and spawn_window.status = 'active'
      and spawn_window.ends_at > clock_timestamp()
  ) then
    raise exception using errcode = '22023', message = 'Ambient spawn window is inactive';
  end if;

  select rarity into strict v_rarity
  from public.relic_catalog
  where relic_id = p_relic_id
    and is_enabled
    and rarity in ('common', 'uncommon');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_spawn_window_id::text, 0)
  );

  select candidate.id into v_candidate_id
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id
    and candidate.owner_user_id = p_user_id
    and candidate.spawn_tier = 'ambient';

  if found then return v_candidate_id; end if;

  select greatest(coalesce(max(candidate.slot_index), 999999) + 1, 1000000)
  into v_slot_index
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id;

  insert into private.relic_spawn_candidates (
    spawn_window_id, slot_index, relic_id, rarity, exact_point,
    safe_location_id, safety_status, safety_limitation, seed_digest,
    spawn_tier, owner_user_id
  ) values (
    p_spawn_window_id, v_slot_index, p_relic_id, v_rarity, v_exact_point,
    null, 'verified_vicinity',
    'Ambient encounter anchored inside the player''s freshly verified immediate area',
    p_seed_digest, 'ambient', p_user_id
  )
  returning id into v_candidate_id;

  return v_candidate_id;
end;
$$;

drop function if exists public.server_list_spawn_candidates(uuid);
create function public.server_list_spawn_candidates(
  p_spawn_window_id uuid,
  p_user_id uuid
)
returns table (
  candidate_id uuid,
  slot_index integer,
  relic_id text,
  rarity text,
  latitude double precision,
  longitude double precision,
  safety_status text,
  spawn_tier text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    candidate.id,
    candidate.slot_index,
    candidate.relic_id,
    candidate.rarity,
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry),
    candidate.safety_status,
    candidate.spawn_tier
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id
    and candidate.status = 'available'
    and (candidate.owner_user_id is null or candidate.owner_user_id = p_user_id)
  order by candidate.slot_index;
$$;

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
  where id = p_candidate_id
    and status = 'available'
    and (owner_user_id is null or owner_user_id = p_user_id);

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
    extensions.st_setsrid(
      extensions.st_makepoint(p_mystery_longitude, p_mystery_latitude), 4326
    )::extensions.geography,
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
  encounter_type text,
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
    candidate.spawn_tier,
    assignment.expires_at,
    assignment.grace_ends_at,
    candidate.safety_status,
    candidate.safety_limitation
  from private.user_relic_assignments as assignment
  join private.relic_spawn_candidates as candidate
    on candidate.id = assignment.spawn_candidate_id
  where assignment.user_id = p_user_id
    and assignment.exploration_zone_id = p_zone_id
    and assignment.status in ('active', 'verification', 'revealed')
    and private.assignment_is_active(
      assignment.expires_at, assignment.grace_ends_at,
      assignment.verification_started_at, clock_timestamp()
    )
  order by assignment.assigned_at;
$$;

drop function if exists public.server_list_nearby_relic_contexts(uuid);
create function public.server_list_nearby_relic_contexts(p_user_id uuid)
returns table (
  assignment_id uuid,
  assignment_status text,
  eligibility_status text,
  encounter_type text,
  exact_latitude double precision,
  exact_longitude double precision
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    assignment.id,
    assignment.status,
    assignment.eligibility_status,
    candidate.spawn_tier,
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry)
  from private.user_relic_assignments as assignment
  join private.relic_spawn_candidates as candidate
    on candidate.id = assignment.spawn_candidate_id
  where assignment.user_id = p_user_id
    and assignment.status in ('active', 'verification', 'revealed')
    and assignment.eligibility_status in ('eligible', 'overridden')
    and private.assignment_is_active(
      assignment.expires_at, assignment.grace_ends_at,
      assignment.verification_started_at, clock_timestamp()
    )
    and not exists (
      select 1 from public.user_relic_collections as collection
      where collection.user_id = p_user_id
        and collection.assignment_id = assignment.id
    );
$$;

drop function if exists public.server_get_proximity_context(uuid, uuid);
create function public.server_get_proximity_context(
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
  encounter_type text,
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
      where collection.user_id = p_user_id
        and collection.assignment_id = p_assignment_id
    ),
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry),
    v_assignment.rarity,
    candidate.spawn_tier,
    v_assignment.expires_at,
    v_assignment.grace_ends_at,
    v_assignment.verification_started_at
  from private.relic_spawn_candidates as candidate
  where candidate.id = v_assignment.spawn_candidate_id;
end;
$$;

revoke all on function public.server_save_spawn_candidate(
  uuid, integer, text, double precision, double precision, uuid, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.server_save_ambient_spawn_candidate(
  uuid, uuid, text, double precision, double precision, text
) from public, anon, authenticated;
revoke all on function public.server_list_spawn_candidates(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.server_assign_relic_candidate(
  uuid, uuid, uuid, double precision, double precision, double precision, integer
) from public, anon, authenticated;
revoke all on function public.server_list_client_mystery_zones(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.server_list_nearby_relic_contexts(uuid)
  from public, anon, authenticated;
revoke all on function public.server_get_proximity_context(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.server_save_spawn_candidate(
  uuid, integer, text, double precision, double precision, uuid, text, text, text, text
) to service_role;
grant execute on function public.server_save_ambient_spawn_candidate(
  uuid, uuid, text, double precision, double precision, text
) to service_role;
grant execute on function public.server_list_spawn_candidates(uuid, uuid) to service_role;
grant execute on function public.server_assign_relic_candidate(
  uuid, uuid, uuid, double precision, double precision, double precision, integer
) to service_role;
grant execute on function public.server_list_client_mystery_zones(uuid, uuid)
  to service_role;
grant execute on function public.server_list_nearby_relic_contexts(uuid)
  to service_role;
grant execute on function public.server_get_proximity_context(uuid, uuid)
  to service_role;

comment on column private.relic_spawn_candidates.spawn_tier is
  'Server-authored encounter class. Exact coordinates remain private.';
comment on column private.relic_spawn_candidates.owner_user_id is
  'Set only for a user-scoped ambient encounter; shared outdoor candidates remain null.';
comment on function public.server_save_ambient_spawn_candidate(
  uuid, uuid, text, double precision, double precision, text
) is
  'Creates at most one Common/Uncommon ambient candidate per user/window at a freshly verified player-area anchor.';

commit;
