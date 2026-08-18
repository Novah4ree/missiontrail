begin;

-- Reusing a deterministic candidate must refresh its active assignment data.
-- The previous conflict clause updated only updated_at, leaving an otherwise
-- valid assignment attached to an expired zone/window or stale mystery area.
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
    set exploration_zone_id = excluded.exploration_zone_id,
        relic_id = excluded.relic_id,
        rarity = excluded.rarity,
        eligibility_status = excluded.eligibility_status,
        mystery_center = excluded.mystery_center,
        mystery_radius_meters = excluded.mystery_radius_meters,
        clue_distance_band_meters = excluded.clue_distance_band_meters,
        expires_at = excluded.expires_at,
        grace_ends_at = excluded.grace_ends_at,
        status = case
          when user_relic_assignments.status in (
            'verification', 'revealed', 'collected', 'revoked'
          ) then user_relic_assignments.status
          else 'active'
        end,
        verification_started_at = case
          when user_relic_assignments.status in ('verification', 'revealed')
            then user_relic_assignments.verification_started_at
          else null
        end,
        revealed_at = case
          when user_relic_assignments.status in ('revealed', 'collected')
            then user_relic_assignments.revealed_at
          else null
        end,
        collected_at = case
          when user_relic_assignments.status = 'collected'
            then user_relic_assignments.collected_at
          else null
        end,
        updated_at = clock_timestamp()
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.server_assign_relic_candidate(
  uuid, uuid, uuid, double precision, double precision, double precision, integer
) from public, anon, authenticated;
grant execute on function public.server_assign_relic_candidate(
  uuid, uuid, uuid, double precision, double precision, double precision, integer
) to service_role;

comment on function public.server_assign_relic_candidate(
  uuid, uuid, uuid, double precision, double precision, double precision, integer
) is
  'Creates or safely refreshes a server-owned relic assignment without resetting an active secure verification, revealed, collected, or revoked state.';

commit;
