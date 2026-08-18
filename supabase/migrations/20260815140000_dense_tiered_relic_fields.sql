begin;

-- Precision-9 exploration cells keep the deterministic shared-world seed close
-- to the verified player anchor. Safe POIs may have been imported with a
-- different geohash precision, so spatial distance is the authoritative filter.
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
stable
set search_path = ''
as $$
  select
    location.id,
    extensions.st_y(location.exact_point::extensions.geometry),
    extensions.st_x(location.exact_point::extensions.geometry)
  from private.safe_spawn_locations as location
  where location.validation_status = 'verified'
    and (location.expires_at is null or location.expires_at > clock_timestamp())
    and extensions.st_dwithin(
      location.exact_point,
      extensions.st_setsrid(
        extensions.st_makepoint(p_center_longitude, p_center_latitude),
        4326
      )::extensions.geography,
      p_radius_meters
    )
  order by location.id;
$$;

comment on function public.server_get_safe_spawn_locations(
  text, double precision, double precision, double precision
) is
  'Service-only spatial lookup for current verified pedestrian/public spawn locations. Region text remains part of the stable API but is not a safety boundary.';

-- A field follows the current verified precision-9 cell, but an in-progress
-- reveal/collection keeps its original zone until the existing grace logic ends.
create or replace function public.server_get_or_create_exploration_zone(
  p_user_id uuid,
  p_region_geohash text,
  p_center_latitude double precision,
  p_center_longitude double precision,
  p_anchor_source text default 'verified_gps'
)
returns table (
  zone_id uuid,
  region_geohash text,
  center_latitude double precision,
  center_longitude double precision,
  active_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zone private.exploration_zones%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  if p_center_latitude not between -90 and 90
    or p_center_longitude not between -180 and 180
    or p_region_geohash !~ '^[0123456789bcdefghjkmnpqrstuvwxyz]{4,9}$' then
    raise exception using errcode = '22023', message = 'Invalid exploration zone';
  end if;

  update private.exploration_zones as zone
  set status = 'expired', updated_at = clock_timestamp()
  where zone.user_id = p_user_id
    and zone.status = 'active'
    and zone.active_until <= clock_timestamp();

  select zone.* into v_zone
  from private.exploration_zones as zone
  where zone.user_id = p_user_id
    and zone.status = 'active'
    and zone.active_until > clock_timestamp()
  order by zone.created_at desc
  limit 1
  for update;

  if found and v_zone.region_geohash = p_region_geohash then
    return query select
      v_zone.id,
      v_zone.region_geohash,
      extensions.st_y(v_zone.region_center::extensions.geometry),
      extensions.st_x(v_zone.region_center::extensions.geometry),
      v_zone.active_until;
    return;
  end if;

  if found and exists (
    select 1
    from private.user_relic_assignments as assignment
    where assignment.user_id = p_user_id
      and assignment.exploration_zone_id = v_zone.id
      and assignment.status in ('verification', 'revealed')
      and private.assignment_is_active(
        assignment.expires_at,
        assignment.grace_ends_at,
        assignment.verification_started_at,
        clock_timestamp()
      )
  ) then
    return query select
      v_zone.id,
      v_zone.region_geohash,
      extensions.st_y(v_zone.region_center::extensions.geometry),
      extensions.st_x(v_zone.region_center::extensions.geometry),
      v_zone.active_until;
    return;
  end if;

  if found then
    update private.user_relic_assignments as assignment
    set status = 'expired', updated_at = clock_timestamp()
    where assignment.user_id = p_user_id
      and assignment.exploration_zone_id = v_zone.id
      and assignment.status = 'active';

    update private.exploration_zones
    set status = 'expired', updated_at = clock_timestamp()
    where id = v_zone.id;
  end if;

  insert into private.exploration_zones (
    user_id,
    region_geohash,
    region_center,
    anchor_source,
    active_until
  ) values (
    p_user_id,
    p_region_geohash,
    extensions.st_setsrid(
      extensions.st_makepoint(p_center_longitude, p_center_latitude),
      4326
    )::extensions.geography,
    p_anchor_source,
    clock_timestamp() + interval '24 hours'
  ) returning * into v_zone;

  return query select
    v_zone.id,
    v_zone.region_geohash,
    extensions.st_y(v_zone.region_center::extensions.geometry),
    extensions.st_x(v_zone.region_center::extensions.geometry),
    v_zone.active_until;
end;
$$;

revoke all on function public.server_get_safe_spawn_locations(
  text, double precision, double precision, double precision
) from public, anon, authenticated;
grant execute on function public.server_get_safe_spawn_locations(
  text, double precision, double precision, double precision
) to service_role;

revoke all on function public.server_get_or_create_exploration_zone(
  uuid, text, double precision, double precision, text
) from public, anon, authenticated;
grant execute on function public.server_get_or_create_exploration_zone(
  uuid, text, double precision, double precision, text
) to service_role;

commit;
