begin;

-- =====================================================
-- ALLOW PLAYERS TO COLLECT MULTIPLE COPIES OF A RELIC
-- =====================================================
--
-- A relic TYPE can be collected unlimited times:
--
-- Fossil Fang x 1
-- Fossil Fang x 2
-- Fossil Fang x 100
--
-- But the exact same spawned relic assignment can only
-- be collected once because assignment_id remains unique.
--

alter table public.user_relic_collections
  drop constraint if exists user_relic_collections_user_id_relic_id_key;


-- Helpful for Vault quantity lookups such as:
-- Fossil Fang x 27
create index if not exists user_relic_collections_user_relic_idx
  on public.user_relic_collections (user_id, relic_id);


-- =====================================================
-- UPDATE SECURE RELIC COLLECTION
-- =====================================================

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
  where id = p_assignment_id
    and user_id = p_user_id
  for update;

  select * into strict v_challenge
  from private.one_time_collection_challenges
  where user_id = p_user_id
    and assignment_id = p_assignment_id
    and purpose = 'collection'
    and token_hash = p_challenge_token_hash
  for update;

  -- If the phone lost the success response, retrying the SAME
  -- assignment returns the existing collection without awarding XP twice.
  if v_challenge.status = 'used' then
    select * into v_collection
    from public.user_relic_collections
    where user_id = p_user_id
      and assignment_id = p_assignment_id;

    if found then
      return query
      select
        v_collection.id,
        v_collection.relic_id,
        v_collection.xp_awarded,
        v_collection.collected_at,
        false;
      return;
    end if;

    raise exception
      using errcode = 'P0001',
      message = 'Collection challenge is unavailable';
  end if;

  if v_challenge.status <> 'issued'
     or v_challenge.expires_at < clock_timestamp() then
    update private.one_time_collection_challenges
    set status = 'expired'
    where id = v_challenge.id
      and status = 'issued';

    raise exception
      using errcode = 'P0001',
      message = 'Collection challenge expired';
  end if;

  if not private.assignment_is_active(
    v_assignment.expires_at,
    v_assignment.grace_ends_at,
    v_assignment.verification_started_at,
    clock_timestamp()
  ) then
    raise exception
      using errcode = 'P0001',
      message = 'Collection expired';
  end if;

  select
    eligibility.rare_eligible,
    eligibility.legendary_eligible
  into
    v_rare,
    v_legendary
  from public.server_get_daily_eligibility(p_user_id) as eligibility;

  if (v_assignment.rarity = 'rare' and not v_rare)
     or
     (v_assignment.rarity = 'legendary' and not v_legendary) then
    raise exception
      using errcode = 'P0001',
      message = 'Collection is ineligible';
  end if;

  select * into strict v_attempt
  from private.location_verification_attempts
  where id = p_verification_attempt_id
    and user_id = p_user_id
    and assignment_id = p_assignment_id
    and purpose = 'collection';

  select * into strict v_config
  from private.relic_server_config
  where singleton;

  if v_attempt.status <> 'verified'
    or v_attempt.verified_at < clock_timestamp() - interval '60 seconds'
    or v_attempt.accurate_reading_count < v_config.required_accurate_readings
    or v_attempt.maximum_accuracy_meters > v_config.max_acceptable_gps_accuracy_meters
    or v_attempt.radius_used_meters > v_config.fallback_reveal_radius_meters then

    raise exception
      using errcode = 'P0001',
      message = 'Final location verification failed';
  end if;

  update private.one_time_collection_challenges
  set
    status = 'used',
    used_at = clock_timestamp()
  where id = v_challenge.id;

  select catalog.xp_reward
  into strict v_xp
  from public.relic_catalog as catalog
  where catalog.relic_id = v_assignment.relic_id
    and catalog.is_enabled;

  -- IMPORTANT:
  --
  -- We now conflict on ASSIGNMENT, not RELIC TYPE.
  --
  -- Different Fossil Fang assignment = collectible.
  -- Same Fossil Fang assignment twice = blocked.
  insert into public.user_relic_collections (
    user_id,
    assignment_id,
    relic_id,
    xp_awarded
  )
  values (
    p_user_id,
    p_assignment_id,
    v_assignment.relic_id,
    v_xp
  )
  on conflict (assignment_id) do nothing
  returning * into v_collection;

  if found then
    v_was_new := true;

    insert into private.xp_ledger (
      user_id,
      source_type,
      source_id,
      xp_delta
    )
    values (
      p_user_id,
      'relic_collection',
      v_collection.id,
      v_xp
    )
    on conflict (user_id, source_type, source_id) do nothing;

  else
    -- Only return a collection belonging to THIS exact spawn.
    select collection.*
    into strict v_collection
    from public.user_relic_collections as collection
    where collection.user_id = p_user_id
      and collection.assignment_id = p_assignment_id;
  end if;

  update private.user_relic_assignments as assignment
  set
    status = 'collected',
    collected_at = coalesce(
      assignment.collected_at,
      v_collection.collected_at
    ),
    updated_at = clock_timestamp()
  where assignment.id = p_assignment_id;

  return query
  select
    v_collection.id,
    v_collection.relic_id,
    v_collection.xp_awarded,
    v_collection.collected_at,
    v_was_new;
end;
$$;

comment on function public.server_complete_relic_collection(
  uuid,
  uuid,
  text,
  uuid
) is
  'Atomically collects one unique relic assignment. Players may own multiple copies of the same relic type, but an assignment can only be collected once.';

commit;
