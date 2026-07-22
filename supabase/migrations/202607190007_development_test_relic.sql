begin;

-- This service-only helper exists solely for an allow-listed development
-- account. The Edge Function validates fresh GPS readings and calculates the
-- five-foot point before calling it. No exact point is returned to the app.
create or replace function public.server_place_development_test_relic(
  p_user_id uuid,
  p_zone_id uuid,
  p_spawn_window_id uuid,
  p_relic_id text,
  p_exact_latitude double precision,
  p_exact_longitude double precision,
  p_mystery_latitude double precision,
  p_mystery_longitude double precision,
  p_mystery_radius_meters double precision,
  p_clue_distance_band_meters integer,
  p_seed_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window private.relic_spawn_windows%rowtype;
  v_rarity text;
  v_slot_index integer;
  v_candidate_id uuid;
  v_assignment_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_spawn_window_id::text, 0)
  );

  if p_exact_latitude not between -90 and 90
    or p_exact_longitude not between -180 and 180
    or p_mystery_latitude not between -90 and 90
    or p_mystery_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'Invalid development relic point';
  end if;

  perform 1
  from private.exploration_zones as zone
  where zone.id = p_zone_id
    and zone.user_id = p_user_id
    and zone.status = 'active'
    and zone.active_until > clock_timestamp();
  if not found then
    raise exception using errcode = '22023', message = 'Development zone unavailable';
  end if;

  select spawn_window.* into strict v_window
  from private.relic_spawn_windows as spawn_window
  join private.exploration_zones as zone
    on zone.id = p_zone_id and zone.region_geohash = spawn_window.region_geohash
  where spawn_window.id = p_spawn_window_id
    and spawn_window.status = 'active'
    and clock_timestamp() < spawn_window.ends_at;

  select catalog.rarity into strict v_rarity
  from public.relic_catalog as catalog
  where catalog.relic_id = p_relic_id
    and catalog.is_enabled
    and catalog.rarity = 'epic';

  update private.user_relic_assignments as assignment
  set status = 'expired', updated_at = clock_timestamp()
  from private.relic_spawn_candidates as candidate
  where assignment.user_id = p_user_id
    and assignment.spawn_candidate_id = candidate.id
    and assignment.status in ('active', 'verification', 'revealed')
    and candidate.safety_limitation = 'Development-only five-foot test relic';

  select coalesce(max(candidate.slot_index), -1) + 1
  into v_slot_index
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id;

  insert into private.relic_spawn_candidates (
    spawn_window_id, slot_index, relic_id, rarity, exact_point,
    safety_status, safety_limitation, seed_digest
  ) values (
    p_spawn_window_id,
    v_slot_index,
    p_relic_id,
    v_rarity,
    extensions.st_setsrid(
      extensions.st_makepoint(p_exact_longitude, p_exact_latitude), 4326
    )::extensions.geography,
    'unverified',
    'Development-only five-foot test relic',
    p_seed_digest
  )
  returning id into v_candidate_id;

  insert into private.user_relic_assignments (
    user_id, exploration_zone_id, spawn_candidate_id, relic_id, rarity,
    eligibility_status, mystery_center, mystery_radius_meters,
    clue_distance_band_meters, expires_at, grace_ends_at
  ) values (
    p_user_id,
    p_zone_id,
    v_candidate_id,
    p_relic_id,
    v_rarity,
    'eligible',
    extensions.st_setsrid(
      extensions.st_makepoint(p_mystery_longitude, p_mystery_latitude), 4326
    )::extensions.geography,
    p_mystery_radius_meters,
    p_clue_distance_band_meters,
    v_window.ends_at,
    v_window.grace_ends_at
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.server_place_development_test_relic(
  uuid, uuid, uuid, text, double precision, double precision,
  double precision, double precision, double precision, integer, text
) from public, anon, authenticated;
grant execute on function public.server_place_development_test_relic(
  uuid, uuid, uuid, text, double precision, double precision,
  double precision, double precision, double precision, integer, text
) to service_role;

comment on function public.server_place_development_test_relic(
  uuid, uuid, uuid, text, double precision, double precision,
  double precision, double precision, double precision, integer, text
) is 'Development-only, service-role test fixture. Never expose exact points to clients.';

commit;
