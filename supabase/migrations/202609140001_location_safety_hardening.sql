begin;

-- Mission Trails must fail closed when the safety status of a discovery point is
-- incomplete. Existing verified rows are intentionally marked stale so they are
-- not reused until they are revalidated against the stricter checks below.
alter table private.safe_spawn_locations
  add column if not exists public_access_verified boolean,
  add column if not exists pedestrian_access_verified boolean,
  add column if not exists inside_building boolean,
  add column if not exists near_high_speed_road boolean,
  add column if not exists near_dangerous_intersection boolean,
  add column if not exists in_or_over_unsafe_water boolean,
  add column if not exists restricted_area boolean,
  add column if not exists inaccessible_property boolean,
  add column if not exists safety_checked_at timestamptz,
  add column if not exists safety_reason text;

update private.safe_spawn_locations
set validation_status = 'stale',
    safety_reason = coalesce(safety_reason, 'Requires Mission Trails safety-v2 revalidation')
where validation_status = 'verified'
  and (
    public_access_verified is distinct from true
    or pedestrian_access_verified is distinct from true
    or inside_building is distinct from false
    or near_high_speed_road is distinct from false
    or near_dangerous_intersection is distinct from false
    or in_or_over_unsafe_water is distinct from false
    or restricted_area is distinct from false
    or inaccessible_property is distinct from false
  );

alter table private.safe_spawn_locations
  drop constraint if exists safe_spawn_locations_verified_safety_check;

alter table private.safe_spawn_locations
  add constraint safe_spawn_locations_verified_safety_check
  check (
    validation_status <> 'verified'
    or (
      public_access_verified is true
      and pedestrian_access_verified is true
      and inside_building is false
      and near_high_speed_road is false
      and near_dangerous_intersection is false
      and in_or_over_unsafe_water is false
      and restricted_area is false
      and inaccessible_property is false
      and safety_checked_at is not null
    )
  );

comment on constraint safe_spawn_locations_verified_safety_check on private.safe_spawn_locations is
  'A production spawn cannot be verified unless public/pedestrian access is confirmed and building, high-speed-road, dangerous-intersection, water, restricted-area, and inaccessible-property checks all pass.';

create or replace function public.server_get_safe_spawn_locations(
  p_region_geohash text,
  p_center_latitude double precision,
  p_center_longitude double precision,
  p_radius_meters double precision
)
returns table (
  safe_location_id uuid,
  latitude double precision,
  longitude double precision
)
language sql
security definer
set search_path = ''
as $$
  select
    location.id,
    extensions.st_y(location.exact_point::extensions.geometry),
    extensions.st_x(location.exact_point::extensions.geometry)
  from private.safe_spawn_locations as location
  where location.region_geohash = p_region_geohash
    and location.validation_status = 'verified'
    and location.public_access_verified is true
    and location.pedestrian_access_verified is true
    and location.inside_building is false
    and location.near_high_speed_road is false
    and location.near_dangerous_intersection is false
    and location.in_or_over_unsafe_water is false
    and location.restricted_area is false
    and location.inaccessible_property is false
    and location.safety_checked_at is not null
    and (location.expires_at is null or location.expires_at > clock_timestamp())
    and extensions.st_dwithin(
      location.exact_point,
      extensions.st_setsrid(
        extensions.st_makepoint(p_center_longitude, p_center_latitude),
        4326
      )::extensions.geography,
      p_radius_meters
    )
  order by extensions.st_distance(
    location.exact_point,
    extensions.st_setsrid(
      extensions.st_makepoint(p_center_longitude, p_center_latitude),
      4326
    )::extensions.geography
  );
$$;

revoke execute on function public.server_get_safe_spawn_locations(text, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.server_get_safe_spawn_locations(text, double precision, double precision, double precision)
  to service_role;

-- Exact coordinates remain in the private schema. No authenticated/anon role is
-- granted direct access to this table.
revoke all on private.safe_spawn_locations from public, anon, authenticated;
grant select, insert, update, delete on private.safe_spawn_locations to service_role;

commit;
