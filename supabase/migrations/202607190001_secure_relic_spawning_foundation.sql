begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.relic_server_config (
  singleton boolean primary key default true check (singleton),
  spawn_window_minutes integer not null default 30 check (spawn_window_minutes > 0),
  search_radius_miles numeric(8, 2) not null default 10 check (search_radius_miles > 0),
  search_radius_meters numeric(12, 2) not null default 16093.44 check (search_radius_meters > 0),
  target_reveal_radius_meters numeric(8, 2) not null default 4.57 check (target_reveal_radius_meters > 0),
  fallback_reveal_radius_meters numeric(8, 2) not null default 9 check (fallback_reveal_radius_meters >= target_reveal_radius_meters),
  required_accurate_readings integer not null default 3 check (required_accurate_readings >= 3),
  max_acceptable_gps_accuracy_meters numeric(8, 2) not null default 12 check (max_acceptable_gps_accuracy_meters > 0),
  rare_distance_miles numeric(8, 2) not null default 5 check (rare_distance_miles > 0),
  rare_distance_meters numeric(12, 2) not null default 8046.72 check (rare_distance_meters > 0),
  legendary_distance_miles numeric(8, 2) not null default 10 check (legendary_distance_miles >= rare_distance_miles),
  legendary_distance_meters numeric(12, 2) not null default 16093.44 check (legendary_distance_meters >= rare_distance_meters),
  daily_mission_override_enabled boolean not null default true,
  expiration_grace_period_seconds integer not null default 120 check (expiration_grace_period_seconds between 1 and 900),
  clue_distance_bands_meters integer[] not null default array[500, 200, 75],
  updated_at timestamptz not null default now(),
  check (cardinality(clue_distance_bands_meters) = 3),
  check (clue_distance_bands_meters[1] > clue_distance_bands_meters[2]),
  check (clue_distance_bands_meters[2] > clue_distance_bands_meters[3]),
  check (clue_distance_bands_meters[3] > 0)
);

insert into private.relic_server_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.relic_catalog (
  relic_id text primary key,
  display_name text not null,
  rarity text not null check (rarity in ('rare', 'epic', 'legendary')),
  xp_reward integer not null check (xp_reward >= 0),
  spawn_weight integer not null default 100 check (spawn_weight > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.relic_catalog is
  'Safe collectible metadata. This table never contains spawn coordinates.';

create table if not exists private.exploration_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  region_geohash text not null check (region_geohash ~ '^[0123456789bcdefghjkmnpqrstuvwxyz]{4,9}$'),
  region_center extensions.geography(Point, 4326) not null,
  anchor_source text not null default 'verified_gps' check (anchor_source in ('verified_gps', 'development_mock', 'admin')),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  active_from timestamptz not null default now(),
  active_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until > active_from)
);

create unique index if not exists exploration_zones_one_active_per_user
  on private.exploration_zones (user_id)
  where status = 'active';
create index if not exists exploration_zones_user_active_idx
  on private.exploration_zones (user_id, status, active_until desc);
create index if not exists exploration_zones_region_idx
  on private.exploration_zones (region_geohash, status);
create index if not exists exploration_zones_geo_idx
  on private.exploration_zones using gist (region_center);

create table if not exists private.relic_spawn_windows (
  id uuid primary key default gen_random_uuid(),
  window_id bigint not null,
  region_geohash text not null,
  zone_center extensions.geography(Point, 4326) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  grace_ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'closed')),
  algorithm_version integer not null default 1 check (algorithm_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_geohash, window_id),
  check (ends_at > starts_at),
  check (grace_ends_at >= ends_at)
);

create index if not exists relic_spawn_windows_active_idx
  on private.relic_spawn_windows (region_geohash, status, starts_at desc);
create index if not exists relic_spawn_windows_expiration_idx
  on private.relic_spawn_windows (ends_at, grace_ends_at, status);

create table if not exists private.safe_spawn_locations (
  id uuid primary key default gen_random_uuid(),
  region_geohash text not null,
  exact_point extensions.geography(Point, 4326) not null,
  location_kind text not null check (location_kind in ('public_trail', 'public_park', 'public_plaza', 'public_sidewalk', 'pedestrian_area')),
  validation_status text not null default 'pending' check (validation_status in ('pending', 'verified', 'rejected', 'stale')),
  data_provider text not null,
  provider_reference text,
  access_tags jsonb not null default '{}'::jsonb,
  validated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_provider, provider_reference)
);

comment on table private.safe_spawn_locations is
  'Server-only candidate POIs. Only verified pedestrian/public locations may be used in production.';

create index if not exists safe_spawn_locations_geo_idx
  on private.safe_spawn_locations using gist (exact_point);
create index if not exists safe_spawn_locations_region_status_idx
  on private.safe_spawn_locations (region_geohash, validation_status);

create table if not exists private.relic_spawn_candidates (
  id uuid primary key default gen_random_uuid(),
  spawn_window_id uuid not null references private.relic_spawn_windows(id) on delete cascade,
  slot_index integer not null check (slot_index >= 0),
  relic_id text not null references public.relic_catalog(relic_id),
  rarity text not null check (rarity in ('rare', 'epic', 'legendary')),
  exact_point extensions.geography(Point, 4326) not null,
  safe_location_id uuid references private.safe_spawn_locations(id),
  safety_status text not null check (safety_status in ('verified', 'unverified')),
  safety_limitation text,
  seed_digest text not null check (length(seed_digest) >= 32),
  status text not null default 'available' check (status in ('available', 'expired', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spawn_window_id, slot_index)
);

comment on column private.relic_spawn_candidates.exact_point is
  'Never expose through a client policy, response, log, error, or metadata.';

create index if not exists relic_spawn_candidates_window_status_idx
  on private.relic_spawn_candidates (spawn_window_id, status, rarity);
create index if not exists relic_spawn_candidates_geo_idx
  on private.relic_spawn_candidates using gist (exact_point);

create table if not exists private.user_daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone_name text not null default 'UTC',
  verified_distance_meters numeric(14, 3) not null default 0 check (verified_distance_meters >= 0),
  required_missions integer not null default 0 check (required_missions >= 0),
  completed_required_missions integer not null default 0 check (completed_required_missions between 0 and required_missions),
  all_required_missions_completed boolean not null default false,
  rare_eligible boolean not null default false,
  legendary_eligible boolean not null default false,
  eligibility_reason text not null default 'distance' check (eligibility_reason in ('distance', 'daily_missions', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists user_daily_progress_user_date_idx
  on private.user_daily_progress (user_id, local_date desc);

create table if not exists private.verified_distance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_progress_id uuid not null references private.user_daily_progress(id) on delete cascade,
  source text not null check (source in ('gps', 'healthkit', 'health_connect', 'development_mock')),
  source_record_hash text not null,
  accepted_distance_meters numeric(12, 3) not null check (accepted_distance_meters >= 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  verification_status text not null check (verification_status in ('accepted', 'rejected', 'pending')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (user_id, source, source_record_hash),
  check (ended_at >= started_at)
);

create index if not exists verified_distance_snapshots_daily_idx
  on private.verified_distance_snapshots (daily_progress_id, verification_status, ended_at);

create table if not exists private.daily_mission_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_progress_id uuid not null references private.user_daily_progress(id) on delete cascade,
  mission_id text not null,
  is_required boolean not null default true,
  status text not null default 'in_progress' check (status in ('locked', 'in_progress', 'completed', 'expired')),
  progress_value numeric(14, 3) not null default 0 check (progress_value >= 0),
  target_value numeric(14, 3) not null check (target_value > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, daily_progress_id, mission_id),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create index if not exists daily_mission_completion_progress_idx
  on private.daily_mission_completion (daily_progress_id, is_required, status);

create table if not exists private.user_relic_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exploration_zone_id uuid not null references private.exploration_zones(id) on delete cascade,
  spawn_candidate_id uuid not null references private.relic_spawn_candidates(id) on delete cascade,
  relic_id text not null references public.relic_catalog(relic_id),
  rarity text not null check (rarity in ('rare', 'epic', 'legendary')),
  eligibility_status text not null check (eligibility_status in ('eligible', 'locked', 'overridden')),
  mystery_center extensions.geography(Point, 4326) not null,
  mystery_radius_meters numeric(10, 2) not null check (mystery_radius_meters > 0),
  clue_distance_band_meters integer not null check (clue_distance_band_meters > 0),
  status text not null default 'active' check (status in ('active', 'verification', 'revealed', 'collected', 'expired', 'revoked')),
  assigned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  grace_ends_at timestamptz not null,
  verification_started_at timestamptz,
  revealed_at timestamptz,
  collected_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, spawn_candidate_id),
  check (grace_ends_at >= expires_at)
);

comment on column private.user_relic_assignments.mystery_center is
  'Deliberately offset client-safe clue center. It is separate from the exact spawn point.';

create index if not exists user_relic_assignments_field_idx
  on private.user_relic_assignments (user_id, exploration_zone_id, status, expires_at);
create index if not exists user_relic_assignments_candidate_idx
  on private.user_relic_assignments (spawn_candidate_id, status);
create index if not exists user_relic_assignments_mystery_geo_idx
  on private.user_relic_assignments using gist (mystery_center);

create table if not exists private.location_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references private.user_relic_assignments(id) on delete cascade,
  purpose text not null check (purpose in ('zone_anchor', 'reveal', 'collection', 'distance')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'expired')),
  accurate_reading_count integer not null default 0 check (accurate_reading_count >= 0),
  maximum_accuracy_meters numeric(10, 3),
  median_point extensions.geography(Point, 4326),
  measured_distance_meters numeric(12, 3),
  radius_used_meters numeric(10, 3),
  rejection_code text,
  payload_digest text not null,
  received_at timestamptz not null default now(),
  verified_at timestamptz,
  retained_until timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique (user_id, purpose, payload_digest),
  check (retained_until > created_at),
  check (
    (purpose in ('reveal', 'collection') and assignment_id is not null)
    or purpose in ('zone_anchor', 'distance')
  )
);

comment on table private.location_verification_attempts is
  'Temporary private verification summaries. Raw routes should not be copied into logs or analytics.';

create index if not exists location_verification_attempts_assignment_idx
  on private.location_verification_attempts (assignment_id, purpose, status, received_at desc);
create index if not exists location_verification_attempts_retention_idx
  on private.location_verification_attempts (retained_until);

create table if not exists private.suspicious_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  assignment_id uuid references private.user_relic_assignments(id) on delete set null,
  event_code text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  sanitized_details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retained_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  check (retained_until > created_at)
);

create index if not exists suspicious_activity_events_user_time_idx
  on private.suspicious_activity_events (user_id, occurred_at desc);
create index if not exists suspicious_activity_events_retention_idx
  on private.suspicious_activity_events (retained_until);

create table if not exists private.one_time_collection_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null references private.user_relic_assignments(id) on delete cascade,
  device_installation_id text not null,
  purpose text not null check (purpose in ('reveal', 'collection')),
  token_hash text not null unique check (length(token_hash) >= 32),
  status text not null default 'issued' check (status in ('issued', 'used', 'expired', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check ((status = 'used' and used_at is not null) or status <> 'used')
);

create index if not exists one_time_challenges_lookup_idx
  on private.one_time_collection_challenges (user_id, assignment_id, purpose, status, expires_at);

create table if not exists public.user_relic_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null unique references private.user_relic_assignments(id),
  relic_id text not null references public.relic_catalog(relic_id),
  xp_awarded integer not null check (xp_awarded >= 0),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, relic_id)
);

comment on table public.user_relic_collections is
  'Client-readable inventory. Exact collection coordinates are intentionally absent.';

create index if not exists user_relic_collections_user_time_idx
  on public.user_relic_collections (user_id, collected_at desc);

create table if not exists private.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('relic_collection', 'mission', 'admin')),
  source_id uuid not null,
  xp_delta integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists xp_ledger_user_time_idx
  on private.xp_ledger (user_id, created_at desc);

create table if not exists private.rate_limit_buckets (
  subject_key text not null,
  endpoint text not null,
  bucket_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (subject_key, endpoint, bucket_started_at)
);

-- Window IDs divide Unix time into exact 30-minute blocks. Only server wrappers
-- call this function in production; the optional timestamp exists for SQL tests.
create or replace function private.spawn_window_id(
  p_now timestamptz,
  p_window_minutes integer default 30
)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select floor(extract(epoch from p_now) / (p_window_minutes * 60))::bigint;
$$;

create or replace function private.assignment_is_active(
  p_expires_at timestamptz,
  p_grace_ends_at timestamptz,
  p_verification_started_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_now < p_expires_at
    or (
      p_verification_started_at is not null
      and p_verification_started_at < p_expires_at
      and p_now <= p_grace_ends_at
    );
$$;

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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if p_center_latitude not between -90 and 90 or p_center_longitude not between -180 and 180 then
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

  if found then
    return query select
      v_zone.id,
      v_zone.region_geohash,
      extensions.st_y(v_zone.region_center::extensions.geometry),
      extensions.st_x(v_zone.region_center::extensions.geometry),
      v_zone.active_until;
    return;
  end if;

  insert into private.exploration_zones (
    user_id, region_geohash, region_center, anchor_source, active_until
  ) values (
    p_user_id,
    p_region_geohash,
    extensions.st_setsrid(extensions.st_makepoint(p_center_longitude, p_center_latitude), 4326)::extensions.geography,
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

create or replace function public.server_get_active_exploration_zone(p_user_id uuid)
returns table (
  zone_id uuid,
  region_geohash text,
  center_latitude double precision,
  center_longitude double precision,
  active_until timestamptz
)
language sql
security definer
volatile
set search_path = ''
as $$
  update private.exploration_zones as expired_zone
  set status = 'expired', updated_at = clock_timestamp()
  where expired_zone.user_id = p_user_id
    and expired_zone.status = 'active'
    and expired_zone.active_until <= clock_timestamp();

  select
    zone.id,
    zone.region_geohash,
    extensions.st_y(zone.region_center::extensions.geometry),
    extensions.st_x(zone.region_center::extensions.geometry),
    zone.active_until
  from private.exploration_zones as zone
  where zone.user_id = p_user_id
    and zone.status = 'active'
    and zone.active_until > clock_timestamp()
  order by zone.created_at desc
  limit 1;
$$;

create or replace function public.server_get_or_create_current_spawn_window(
  p_region_geohash text,
  p_center_latitude double precision,
  p_center_longitude double precision,
  p_window_minutes integer default 30,
  p_grace_period_seconds integer default 120
)
returns table (
  spawn_window_id uuid,
  window_id bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  grace_ends_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_id bigint;
  v_starts_at timestamptz;
  v_window private.relic_spawn_windows%rowtype;
  v_created boolean := false;
begin
  v_window_id := private.spawn_window_id(v_now, p_window_minutes);
  v_starts_at := to_timestamp(v_window_id * p_window_minutes * 60);

  insert into private.relic_spawn_windows (
    window_id, region_geohash, zone_center, starts_at, ends_at, grace_ends_at
  ) values (
    v_window_id,
    p_region_geohash,
    extensions.st_setsrid(extensions.st_makepoint(p_center_longitude, p_center_latitude), 4326)::extensions.geography,
    v_starts_at,
    v_starts_at + make_interval(mins => p_window_minutes),
    v_starts_at + make_interval(mins => p_window_minutes, secs => p_grace_period_seconds)
  )
  on conflict on constraint relic_spawn_windows_region_geohash_window_id_key do nothing
  returning * into v_window;

  if found then
    v_created := true;
  else
    select existing.* into strict v_window
    from private.relic_spawn_windows as existing
    where existing.region_geohash = p_region_geohash
      and existing.window_id = v_window_id;
  end if;

  return query select
    v_window.id,
    v_window.window_id,
    v_window.starts_at,
    v_window.ends_at,
    v_window.grace_ends_at,
    v_created;
end;
$$;

create or replace function public.server_record_zone_anchor_attempt(
  p_user_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_reading_count integer,
  p_maximum_accuracy_meters double precision,
  p_payload_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
begin
  insert into private.location_verification_attempts (
    user_id,
    assignment_id,
    purpose,
    status,
    accurate_reading_count,
    maximum_accuracy_meters,
    median_point,
    payload_digest,
    verified_at
  ) values (
    p_user_id,
    null,
    'zone_anchor',
    'verified',
    p_reading_count,
    p_maximum_accuracy_meters,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_payload_digest,
    clock_timestamp()
  )
  on conflict (user_id, purpose, payload_digest) do update
    set retained_until = greatest(
      location_verification_attempts.retained_until,
      clock_timestamp() + interval '24 hours'
    )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

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
  where location.region_geohash = p_region_geohash
    and location.validation_status = 'verified'
    and (location.expires_at is null or location.expires_at > clock_timestamp())
    and extensions.st_dwithin(
      location.exact_point,
      extensions.st_setsrid(extensions.st_makepoint(p_center_longitude, p_center_latitude), 4326)::extensions.geography,
      p_radius_meters
    )
  order by location.id;
$$;

create or replace function public.server_save_spawn_candidate(
  p_spawn_window_id uuid,
  p_slot_index integer,
  p_relic_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_safe_location_id uuid,
  p_safety_status text,
  p_safety_limitation text,
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
begin
  select rarity into strict v_rarity
  from public.relic_catalog
  where relic_id = p_relic_id and is_enabled;

  insert into private.relic_spawn_candidates (
    spawn_window_id, slot_index, relic_id, rarity, exact_point,
    safe_location_id, safety_status, safety_limitation, seed_digest
  ) values (
    p_spawn_window_id,
    p_slot_index,
    p_relic_id,
    v_rarity,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_safe_location_id,
    p_safety_status,
    p_safety_limitation,
    p_seed_digest
  )
  on conflict (spawn_window_id, slot_index) do update
    set updated_at = excluded.updated_at
  returning id into v_candidate_id;

  return v_candidate_id;
end;
$$;

create or replace function public.server_list_spawn_candidates(p_spawn_window_id uuid)
returns table (
  candidate_id uuid,
  slot_index integer,
  relic_id text,
  rarity text,
  latitude double precision,
  longitude double precision,
  safety_status text
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
    candidate.safety_status
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id
    and candidate.status = 'available'
  order by candidate.slot_index;
$$;

create or replace function public.server_get_daily_eligibility(p_user_id uuid)
returns table (
  rare_eligible boolean,
  legendary_eligible boolean,
  mission_override boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  with config as (
    select * from private.relic_server_config where singleton
  ), progress as (
    select daily.*
    from private.user_daily_progress as daily
    where daily.user_id = p_user_id
    order by daily.local_date desc
    limit 1
  )
  select
    coalesce(progress.verified_distance_meters >= config.rare_distance_meters, false)
      or coalesce(config.daily_mission_override_enabled and progress.all_required_missions_completed, false),
    coalesce(progress.verified_distance_meters >= config.legendary_distance_meters, false)
      or coalesce(config.daily_mission_override_enabled and progress.all_required_missions_completed, false),
    coalesce(config.daily_mission_override_enabled and progress.all_required_missions_completed, false)
  from config
  left join progress on true;
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
  where id = p_candidate_id and status = 'available';

  select * into strict v_window
  from private.relic_spawn_windows
  where id = v_candidate.spawn_window_id;

  select * into v_rare_eligible, v_legendary_eligible, v_override
  from public.server_get_daily_eligibility(p_user_id);

  if v_candidate.rarity = 'rare' and not v_rare_eligible then return null; end if;
  if v_candidate.rarity = 'legendary' and not v_legendary_eligible then return null; end if;

  v_eligibility_status := case when v_override and v_candidate.rarity in ('rare', 'legendary')
    then 'overridden' else 'eligible' end;

  insert into private.user_relic_assignments (
    user_id, exploration_zone_id, spawn_candidate_id, relic_id, rarity,
    eligibility_status, mystery_center, mystery_radius_meters,
    clue_distance_band_meters, expires_at, grace_ends_at
  ) values (
    p_user_id,
    p_zone_id,
    p_candidate_id,
    v_candidate.relic_id,
    v_candidate.rarity,
    v_eligibility_status,
    extensions.st_setsrid(extensions.st_makepoint(p_mystery_longitude, p_mystery_latitude), 4326)::extensions.geography,
    p_mystery_radius_meters,
    p_clue_distance_band_meters,
    v_window.ends_at,
    v_window.grace_ends_at
  )
  on conflict (user_id, spawn_candidate_id) do update
    set updated_at = excluded.updated_at
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

create or replace function public.server_expire_old_relic_assignments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update private.user_relic_assignments
  set status = 'expired', updated_at = clock_timestamp()
  where status in ('active', 'verification', 'revealed')
    and not private.assignment_is_active(
      expires_at,
      grace_ends_at,
      verification_started_at,
      clock_timestamp()
    );
  get diagnostics v_count = row_count;

  update private.relic_spawn_windows
  set status = 'expired', updated_at = clock_timestamp()
  where status = 'active' and grace_ends_at < clock_timestamp();

  update private.relic_spawn_candidates as candidate
  set status = 'expired', updated_at = clock_timestamp()
  from private.relic_spawn_windows as spawn_window
  where candidate.spawn_window_id = spawn_window.id
    and spawn_window.status = 'expired'
    and candidate.status = 'available';

  return v_count;
end;
$$;

create or replace function public.server_list_client_mystery_zones(
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
  -- This response deliberately omits relic ID, rarity, seed data, exact point,
  -- exact bearing, and exact distance. The Edge Function returns it unchanged.
  select
    assignment.id,
    extensions.st_y(assignment.mystery_center::extensions.geometry),
    extensions.st_x(assignment.mystery_center::extensions.geometry),
    assignment.mystery_radius_meters::double precision,
    assignment.clue_distance_band_meters,
    assignment.status,
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
      assignment.expires_at,
      assignment.grace_ends_at,
      assignment.verification_started_at,
      clock_timestamp()
    )
  order by assignment.assigned_at;
$$;

create or replace function public.server_consume_field_rate_limit(
  p_subject_key text,
  p_endpoint text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_bucket timestamptz := date_trunc('minute', clock_timestamp());
begin
  insert into private.rate_limit_buckets (subject_key, endpoint, bucket_started_at)
  values (p_subject_key, p_endpoint, v_bucket)
  on conflict (subject_key, endpoint, bucket_started_at) do update
    set request_count = rate_limit_buckets.request_count + 1,
        updated_at = clock_timestamp()
  returning request_count into v_count;

  return v_count <= p_limit;
end;
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
  v_xp integer;
  v_was_new boolean := false;
begin
  select * into strict v_assignment
  from private.user_relic_assignments
  where id = p_assignment_id and user_id = p_user_id
  for update;

  if not private.assignment_is_active(
    v_assignment.expires_at,
    v_assignment.grace_ends_at,
    v_assignment.verification_started_at,
    clock_timestamp()
  ) then
    raise exception using errcode = 'P0001', message = 'Collection is unavailable';
  end if;

  select * into strict v_challenge
  from private.one_time_collection_challenges
  where user_id = p_user_id
    and assignment_id = p_assignment_id
    and purpose = 'collection'
    and token_hash = p_challenge_token_hash
  for update;

  if v_challenge.status <> 'issued' or v_challenge.expires_at < clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Collection is unavailable';
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
    or v_attempt.accurate_reading_count < v_config.required_accurate_readings
    or v_attempt.maximum_accuracy_meters is null
    or v_attempt.maximum_accuracy_meters > v_config.max_acceptable_gps_accuracy_meters
    or v_attempt.radius_used_meters is null
    or v_attempt.radius_used_meters > v_config.fallback_reveal_radius_meters then
    raise exception using errcode = 'P0001', message = 'Collection is unavailable';
  end if;

  update private.one_time_collection_challenges
  set status = 'used', used_at = clock_timestamp()
  where id = v_challenge.id;

  select catalog.xp_reward into strict v_xp
  from public.relic_catalog as catalog
  where catalog.relic_id = v_assignment.relic_id and catalog.is_enabled;

  insert into public.user_relic_collections (
    user_id, assignment_id, relic_id, xp_awarded
  ) values (
    p_user_id, p_assignment_id, v_assignment.relic_id, v_xp
  )
  on conflict on constraint user_relic_collections_user_id_relic_id_key do nothing
  returning * into v_collection;

  if found then
    v_was_new := true;
    insert into private.xp_ledger (user_id, source_type, source_id, xp_delta)
    values (p_user_id, 'relic_collection', v_collection.id, v_xp)
    on conflict (user_id, source_type, source_id) do nothing;

    update private.user_relic_assignments
    set status = 'collected', collected_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = p_assignment_id;
  else
    select collection.* into strict v_collection
    from public.user_relic_collections as collection
    where collection.user_id = p_user_id
      and collection.relic_id = v_assignment.relic_id;
  end if;

  return query select
    v_collection.id,
    v_collection.relic_id,
    v_collection.xp_awarded,
    v_collection.collected_at,
    v_was_new;
end;
$$;

alter table public.relic_catalog enable row level security;
alter table public.user_relic_collections enable row level security;
alter table private.relic_server_config enable row level security;
alter table private.exploration_zones enable row level security;
alter table private.relic_spawn_windows enable row level security;
alter table private.safe_spawn_locations enable row level security;
alter table private.relic_spawn_candidates enable row level security;
alter table private.user_daily_progress enable row level security;
alter table private.verified_distance_snapshots enable row level security;
alter table private.daily_mission_completion enable row level security;
alter table private.user_relic_assignments enable row level security;
alter table private.location_verification_attempts enable row level security;
alter table private.suspicious_activity_events enable row level security;
alter table private.one_time_collection_challenges enable row level security;
alter table private.xp_ledger enable row level security;
alter table private.rate_limit_buckets enable row level security;

drop policy if exists "relic catalog is readable" on public.relic_catalog;
create policy "relic catalog is readable"
  on public.relic_catalog for select
  to anon, authenticated
  using (is_enabled);

drop policy if exists "users read their own relic collections" on public.user_relic_collections;
create policy "users read their own relic collections"
  on public.user_relic_collections for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on public.user_relic_collections from anon, authenticated;
grant select on public.user_relic_collections to authenticated;
revoke all on public.relic_catalog from anon, authenticated;
grant select on public.relic_catalog to anon, authenticated;

revoke execute on function public.server_get_or_create_exploration_zone(uuid, text, double precision, double precision, text) from public, anon, authenticated;
revoke execute on function public.server_get_active_exploration_zone(uuid) from public, anon, authenticated;
revoke execute on function public.server_get_or_create_current_spawn_window(text, double precision, double precision, integer, integer) from public, anon, authenticated;
revoke execute on function public.server_record_zone_anchor_attempt(uuid, double precision, double precision, integer, double precision, text) from public, anon, authenticated;
revoke execute on function public.server_get_safe_spawn_locations(text, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.server_save_spawn_candidate(uuid, integer, text, double precision, double precision, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.server_list_spawn_candidates(uuid) from public, anon, authenticated;
revoke execute on function public.server_get_daily_eligibility(uuid) from public, anon, authenticated;
revoke execute on function public.server_assign_relic_candidate(uuid, uuid, uuid, double precision, double precision, double precision, integer) from public, anon, authenticated;
revoke execute on function public.server_expire_old_relic_assignments() from public, anon, authenticated;
revoke execute on function public.server_list_client_mystery_zones(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.server_consume_field_rate_limit(text, text, integer) from public, anon, authenticated;
revoke execute on function public.server_complete_relic_collection(uuid, uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.server_get_or_create_exploration_zone(uuid, text, double precision, double precision, text) to service_role;
grant execute on function public.server_get_active_exploration_zone(uuid) to service_role;
grant execute on function public.server_get_or_create_current_spawn_window(text, double precision, double precision, integer, integer) to service_role;
grant execute on function public.server_record_zone_anchor_attempt(uuid, double precision, double precision, integer, double precision, text) to service_role;
grant execute on function public.server_get_safe_spawn_locations(text, double precision, double precision, double precision) to service_role;
grant execute on function public.server_save_spawn_candidate(uuid, integer, text, double precision, double precision, uuid, text, text, text) to service_role;
grant execute on function public.server_list_spawn_candidates(uuid) to service_role;
grant execute on function public.server_get_daily_eligibility(uuid) to service_role;
grant execute on function public.server_assign_relic_candidate(uuid, uuid, uuid, double precision, double precision, double precision, integer) to service_role;
grant execute on function public.server_expire_old_relic_assignments() to service_role;
grant execute on function public.server_list_client_mystery_zones(uuid, uuid) to service_role;
grant execute on function public.server_consume_field_rate_limit(text, text, integer) to service_role;
grant execute on function public.server_complete_relic_collection(uuid, uuid, text, uuid) to service_role;

comment on function public.server_list_client_mystery_zones(uuid, uuid) is
  'The only field-listing routine used by clients, via an authenticated Edge Function. It never returns exact coordinates.';
comment on function public.server_complete_relic_collection(uuid, uuid, text, uuid) is
  'Atomic, idempotent server-authoritative relic collection and XP award.';

commit;
