begin;

-- The current art catalog uses Epic/Rare/Legendary, while the authoritative schema
-- also supports future Common and Uncommon relic definitions without a migration.
alter table public.relic_catalog drop constraint if exists relic_catalog_rarity_check;
alter table public.relic_catalog add constraint relic_catalog_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));
alter table private.relic_spawn_candidates drop constraint if exists relic_spawn_candidates_rarity_check;
alter table private.relic_spawn_candidates add constraint relic_spawn_candidates_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));
alter table private.user_relic_assignments drop constraint if exists user_relic_assignments_rarity_check;
alter table private.user_relic_assignments add constraint user_relic_assignments_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

-- Distance is never accepted as a client-computed total. The Edge Function validates
-- individual segments and only service-role routines can update these private rows.
alter table private.relic_server_config
  add column if not exists max_movement_speed_meters_per_second numeric(8, 4) not null default 8.9408
    check (max_movement_speed_meters_per_second > 0),
  add column if not exists max_offline_sample_age_hours integer not null default 24
    check (max_offline_sample_age_hours between 1 and 72),
  add column if not exists location_retention_hours integer not null default 24
    check (location_retention_hours between 1 and 168),
  add column if not exists maximum_verified_daily_distance_meters numeric(12, 2) not null default 50000
    check (maximum_verified_daily_distance_meters >= legendary_distance_meters);

alter table private.user_daily_progress
  add column if not exists rare_earned_at timestamptz,
  add column if not exists legendary_earned_at timestamptz,
  add column if not exists mission_override_earned_at timestamptz,
  add column if not exists rare_effective_window_id bigint,
  add column if not exists legendary_effective_window_id bigint,
  add column if not exists mission_override_effective_window_id bigint,
  add column if not exists verified_active_seconds integer not null default 0 check (verified_active_seconds >= 0),
  add column if not exists verified_session_count integer not null default 0 check (verified_session_count >= 0);

create table if not exists private.user_timezones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone_name text not null default 'UTC',
  timezone_status text not null default 'fallback' check (timezone_status in ('verified', 'fallback')),
  source text not null default 'server_default' check (source in ('device_hint', 'server_default', 'admin')),
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.distance_ingestion_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gps', 'healthkit', 'health_connect', 'development_mock')),
  batch_digest text not null check (length(batch_digest) >= 32),
  sample_count integer not null check (sample_count between 1 and 1000),
  status text not null default 'processing' check (status in ('processing', 'accepted', 'partially_accepted', 'rejected', 'replayed')),
  accepted_segment_count integer not null default 0 check (accepted_segment_count >= 0),
  rejected_segment_count integer not null default 0 check (rejected_segment_count >= 0),
  rejection_code text,
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  retained_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  unique (user_id, provider, batch_digest),
  check (retained_until > created_at)
);

create index if not exists distance_ingestion_batches_user_time_idx
  on private.distance_ingestion_batches (user_id, received_at desc);

alter table private.verified_distance_snapshots
  add column if not exists ingestion_batch_id uuid references private.distance_ingestion_batches(id) on delete set null,
  add column if not exists activity_type text check (activity_type in ('walking', 'running')),
  add column if not exists duration_seconds integer check (duration_seconds >= 0),
  add column if not exists average_speed_meters_per_second numeric(10, 4),
  add column if not exists retained_until timestamptz not null default (now() + interval '30 days');

create index if not exists verified_distance_snapshots_overlap_idx
  on private.verified_distance_snapshots (user_id, started_at, ended_at)
  where verification_status = 'accepted';

create table if not exists private.movement_sample_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingestion_batch_id uuid not null references private.distance_ingestion_batches(id) on delete cascade,
  provider text not null check (provider in ('gps', 'development_mock')),
  sample_digest text not null,
  captured_at timestamptz not null,
  exact_point extensions.geography(Point, 4326),
  accuracy_meters numeric(8, 3),
  reported_speed_meters_per_second numeric(10, 4),
  mocked boolean not null default false,
  status text not null check (status in ('accepted', 'rejected')),
  rejection_code text,
  received_at timestamptz not null default now(),
  retained_until timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique (user_id, provider, sample_digest),
  check (retained_until > created_at)
);

comment on table private.movement_sample_evidence is
  'Temporary exact GPS evidence for fraud review. Purge after retained_until; never expose via the API schema.';

create index if not exists movement_sample_evidence_retention_idx
  on private.movement_sample_evidence (retained_until);

create table if not exists private.daily_mission_definitions (
  mission_id text primary key,
  title text not null,
  metric text not null check (metric in ('verified_distance_meters', 'verified_active_seconds', 'verified_session_count')),
  target_value numeric(14, 3) not null check (target_value > 0),
  is_required boolean not null default true,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.daily_mission_definitions (mission_id, title, metric, target_value, is_required, sort_order)
values
  ('verified-walk-one-mile', 'Walk or run 1 verified mile', 'verified_distance_meters', 1609.344, true, 10),
  ('verified-active-twenty-minutes', 'Explore on foot for 20 verified minutes', 'verified_active_seconds', 1200, true, 20),
  ('verified-movement-session', 'Complete a verified walking or running session', 'verified_session_count', 1, true, 30)
on conflict (mission_id) do update set
  title = excluded.title,
  metric = excluded.metric,
  target_value = excluded.target_value,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order,
  updated_at = clock_timestamp();

create or replace function private.valid_timezone_or_utc(p_timezone_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select name from pg_catalog.pg_timezone_names where name = p_timezone_name limit 1),
    'UTC'
  );
$$;

create or replace function private.user_local_context(
  p_user_id uuid,
  p_at timestamptz
)
returns table (local_date date, timezone_name text, used_fallback boolean)
language sql
stable
set search_path = ''
as $$
  with zone as (
    select private.valid_timezone_or_utc(timezone.timezone_name) as name,
           timezone.timezone_status = 'fallback' as fallback
    from private.user_timezones as timezone
    where timezone.user_id = p_user_id
  )
  select
    (p_at at time zone coalesce(zone.name, 'UTC'))::date,
    coalesce(zone.name, 'UTC'),
    coalesce(zone.fallback, true)
  from (select 1) as seed
  left join zone on true;
$$;

create or replace function public.server_set_user_timezone(
  p_user_id uuid,
  p_timezone_name text
)
returns table (timezone_name text, timezone_status text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested text := private.valid_timezone_or_utc(p_timezone_name);
  v_status text := case when v_requested = p_timezone_name then 'verified' else 'fallback' end;
  v_existing private.user_timezones%rowtype;
  v_changed boolean := false;
begin
  select * into v_existing from private.user_timezones where user_id = p_user_id for update;

  if not found then
    insert into private.user_timezones (user_id, timezone_name, timezone_status, source)
    values (p_user_id, v_requested, v_status, case when v_status = 'verified' then 'device_hint' else 'server_default' end);
    v_changed := true;
  elsif v_existing.timezone_name <> v_requested
    and v_existing.last_changed_at <= clock_timestamp() - interval '24 hours' then
    update private.user_timezones
    set timezone_name = v_requested,
        timezone_status = v_status,
        source = case when v_status = 'verified' then 'device_hint' else 'server_default' end,
        last_changed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where user_id = p_user_id;
    v_changed := true;
  else
    v_requested := v_existing.timezone_name;
    v_status := v_existing.timezone_status;
  end if;

  return query select v_requested, v_status, v_changed;
end;
$$;

create or replace function private.ensure_daily_progress(p_user_id uuid, p_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_progress_id uuid;
begin
  select * into strict v_context from private.user_local_context(p_user_id, p_at);

  insert into private.user_daily_progress (user_id, local_date, timezone_name)
  values (p_user_id, v_context.local_date, v_context.timezone_name)
  on conflict (user_id, local_date) do update
    set timezone_name = excluded.timezone_name, updated_at = clock_timestamp()
  returning id into v_progress_id;

  insert into private.daily_mission_completion (
    user_id, daily_progress_id, mission_id, is_required, target_value
  )
  select p_user_id, v_progress_id, definition.mission_id,
         definition.is_required, definition.target_value
  from private.daily_mission_definitions as definition
  where definition.is_enabled
  on conflict (user_id, daily_progress_id, mission_id) do nothing;

  return v_progress_id;
end;
$$;

create or replace function public.server_begin_distance_batch(
  p_user_id uuid,
  p_provider text,
  p_batch_digest text,
  p_sample_count integer
)
returns table (batch_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from private.distance_ingestion_batches
  where user_id = p_user_id and provider = p_provider and batch_digest = p_batch_digest;

  if found then
    return query select v_id, true;
    return;
  end if;

  insert into private.distance_ingestion_batches (user_id, provider, batch_digest, sample_count)
  values (p_user_id, p_provider, p_batch_digest, p_sample_count)
  returning id into v_id;

  return query select v_id, false;
end;
$$;

create or replace function public.server_record_movement_evidence(
  p_user_id uuid,
  p_batch_id uuid,
  p_provider text,
  p_sample_digest text,
  p_captured_at timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_reported_speed_meters_per_second double precision,
  p_mocked boolean,
  p_status text,
  p_rejection_code text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.movement_sample_evidence (
    user_id, ingestion_batch_id, provider, sample_digest, captured_at, exact_point,
    accuracy_meters, reported_speed_meters_per_second, mocked, status,
    rejection_code, retained_until
  )
  select p_user_id, p_batch_id, p_provider, p_sample_digest, p_captured_at,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_accuracy_meters, p_reported_speed_meters_per_second, p_mocked, p_status,
    p_rejection_code, clock_timestamp() + (config.location_retention_hours || ' hours')::interval
  from private.relic_server_config as config where config.singleton
  on conflict (user_id, provider, sample_digest) do nothing;
$$;

create or replace function private.recompute_daily_progress(p_progress_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.relic_server_config%rowtype;
  v_distance numeric;
  v_seconds integer;
  v_sessions integer;
  v_required integer;
  v_completed integer;
  v_override boolean;
  v_next_window bigint;
begin
  perform 1 from private.user_daily_progress where id = p_progress_id for update;
  select * into strict v_config from private.relic_server_config where singleton;

  select coalesce(sum(accepted_distance_meters), 0),
         coalesce(sum(duration_seconds), 0),
         count(distinct ingestion_batch_id)
  into v_distance, v_seconds, v_sessions
  from private.verified_distance_snapshots
  where daily_progress_id = p_progress_id and verification_status = 'accepted';

  update private.daily_mission_completion as completion
  set progress_value = case definition.metric
        when 'verified_distance_meters' then v_distance
        when 'verified_active_seconds' then v_seconds
        when 'verified_session_count' then v_sessions
      end,
      status = case when case definition.metric
        when 'verified_distance_meters' then v_distance
        when 'verified_active_seconds' then v_seconds
        when 'verified_session_count' then v_sessions
      end >= completion.target_value then 'completed' else 'in_progress' end,
      completed_at = case when case definition.metric
        when 'verified_distance_meters' then v_distance
        when 'verified_active_seconds' then v_seconds
        when 'verified_session_count' then v_sessions
      end >= completion.target_value then coalesce(completion.completed_at, clock_timestamp()) else null end,
      updated_at = clock_timestamp()
  from private.daily_mission_definitions as definition
  where completion.daily_progress_id = p_progress_id
    and definition.mission_id = completion.mission_id;

  select count(*) filter (where is_required),
         count(*) filter (where is_required and status = 'completed')
  into v_required, v_completed
  from private.daily_mission_completion
  where daily_progress_id = p_progress_id;

  v_override := v_config.daily_mission_override_enabled and v_required > 0 and v_completed = v_required;
  v_next_window := private.spawn_window_id(clock_timestamp(), v_config.spawn_window_minutes) + 1;

  update private.user_daily_progress
  set verified_distance_meters = v_distance,
      verified_active_seconds = v_seconds,
      verified_session_count = v_sessions,
      required_missions = v_required,
      completed_required_missions = v_completed,
      all_required_missions_completed = v_override,
      rare_eligible = v_distance >= v_config.rare_distance_meters or v_override,
      legendary_eligible = v_distance >= v_config.legendary_distance_meters or v_override,
      eligibility_reason = case when v_override then 'daily_missions'
        when v_distance >= v_config.rare_distance_meters then 'distance' else 'none' end,
      rare_earned_at = case when v_distance >= v_config.rare_distance_meters or v_override
        then coalesce(rare_earned_at, clock_timestamp()) else null end,
      legendary_earned_at = case when v_distance >= v_config.legendary_distance_meters or v_override
        then coalesce(legendary_earned_at, clock_timestamp()) else null end,
      mission_override_earned_at = case when v_override
        then coalesce(mission_override_earned_at, clock_timestamp()) else null end,
      rare_effective_window_id = case when v_distance >= v_config.rare_distance_meters or v_override
        then coalesce(rare_effective_window_id, v_next_window) else null end,
      legendary_effective_window_id = case when v_distance >= v_config.legendary_distance_meters or v_override
        then coalesce(legendary_effective_window_id, v_next_window) else null end,
      mission_override_effective_window_id = case when v_override
        then coalesce(mission_override_effective_window_id, v_next_window) else null end,
      updated_at = clock_timestamp()
  where id = p_progress_id;
end;
$$;

create or replace function public.server_record_verified_segment(
  p_user_id uuid,
  p_batch_id uuid,
  p_source text,
  p_segment_hash text,
  p_activity_type text,
  p_distance_meters double precision,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_seconds integer,
  p_average_speed_meters_per_second double precision
)
returns table (accepted boolean, rejection_code text, counted_distance_meters numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.relic_server_config%rowtype;
  v_progress_id uuid;
  v_existing private.verified_distance_snapshots%rowtype;
  v_daily_distance numeric;
  v_reason text;
begin
  select * into strict v_config from private.relic_server_config where singleton;

  if not exists (
    select 1 from private.distance_ingestion_batches
    where id = p_batch_id and user_id = p_user_id and provider = p_source
  ) then raise exception using errcode = 'P0001', message = 'Distance batch is unavailable'; end if;

  select * into v_existing from private.verified_distance_snapshots
  where user_id = p_user_id and source = p_source and source_record_hash = p_segment_hash;
  if found then
    return query select v_existing.verification_status = 'accepted',
      v_existing.rejection_reason, v_existing.accepted_distance_meters;
    return;
  end if;

  v_progress_id := private.ensure_daily_progress(p_user_id, p_ended_at);
  -- Serialize updates for one user/day so simultaneous offline batches cannot race
  -- past daily growth or deduplication checks.
  select verified_distance_meters into v_daily_distance
  from private.user_daily_progress where id = v_progress_id for update;

  if p_activity_type not in ('walking', 'running') then v_reason := 'unsupported_movement';
  elsif p_ended_at <= p_started_at then v_reason := 'invalid_timestamp';
  elsif p_ended_at > clock_timestamp() + interval '2 minutes' then v_reason := 'future_sample';
  elsif p_started_at < clock_timestamp() - (v_config.max_offline_sample_age_hours || ' hours')::interval then v_reason := 'stale_sample';
  elsif p_distance_meters <= 0 or p_duration_seconds <= 0 then v_reason := 'invalid_segment';
  elsif p_average_speed_meters_per_second > v_config.max_movement_speed_meters_per_second then v_reason := 'speed_too_high';
  elsif exists (
    select 1 from private.verified_distance_snapshots as snapshot
    where snapshot.user_id = p_user_id
      and snapshot.verification_status = 'accepted'
      and tstzrange(snapshot.started_at, snapshot.ended_at, '[)') && tstzrange(p_started_at, p_ended_at, '[)')
  ) then v_reason := 'overlapping_activity';
  else
    if v_daily_distance + p_distance_meters > v_config.maximum_verified_daily_distance_meters then
      v_reason := 'unrealistic_daily_growth';
    end if;
  end if;

  insert into private.verified_distance_snapshots (
    user_id, daily_progress_id, source, source_record_hash, accepted_distance_meters,
    started_at, ended_at, verification_status, rejection_reason, ingestion_batch_id,
    activity_type, duration_seconds, average_speed_meters_per_second
  ) values (
    p_user_id, v_progress_id, p_source, p_segment_hash,
    case when v_reason is null then p_distance_meters else 0 end,
    p_started_at, p_ended_at, case when v_reason is null then 'accepted' else 'rejected' end,
    v_reason, p_batch_id, p_activity_type, p_duration_seconds,
    p_average_speed_meters_per_second
  );

  if v_reason is null then perform private.recompute_daily_progress(v_progress_id); end if;

  return query select v_reason is null, v_reason,
    case when v_reason is null then p_distance_meters::numeric else 0::numeric end;
end;
$$;

create or replace function public.server_finish_distance_batch(
  p_user_id uuid,
  p_batch_id uuid,
  p_accepted_count integer,
  p_rejected_count integer,
  p_rejection_code text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.distance_ingestion_batches
  set accepted_segment_count = p_accepted_count,
      rejected_segment_count = p_rejected_count,
      rejection_code = p_rejection_code,
      status = case when p_accepted_count > 0 and p_rejected_count > 0 then 'partially_accepted'
        when p_accepted_count > 0 then 'accepted' else 'rejected' end,
      completed_at = clock_timestamp()
  where id = p_batch_id and user_id = p_user_id;
$$;

create or replace function public.server_record_suspicious_event(
  p_user_id uuid,
  p_event_code text,
  p_risk_level text,
  p_sanitized_details jsonb default '{}'::jsonb,
  p_assignment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into private.suspicious_activity_events (
    user_id, assignment_id, event_code, risk_level, sanitized_details
  ) values (p_user_id, p_assignment_id, p_event_code, p_risk_level,
    coalesce(p_sanitized_details, '{}'::jsonb) - 'latitude' - 'longitude' - 'coordinates')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.guard_collection_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.location_verification_attempts as attempt
    where attempt.user_id = new.user_id
      and attempt.assignment_id = new.assignment_id
      and attempt.purpose = 'collection'
      and attempt.status = 'verified'
      and attempt.received_at >= clock_timestamp() - interval '60 seconds'
      and attempt.verified_at >= clock_timestamp() - interval '60 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'Recent location verification is required';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_relic_collection_insert on public.user_relic_collections;
create trigger guard_relic_collection_insert
before insert on public.user_relic_collections
for each row execute function private.guard_collection_insert();

create or replace function private.flag_repeated_collection_attempts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_recent_count integer;
begin
  if new.purpose <> 'collection' then return new; end if;

  select count(*) into v_recent_count
  from private.location_verification_attempts
  where user_id = new.user_id
    and purpose = 'collection'
    and received_at >= clock_timestamp() - interval '5 minutes';

  if v_recent_count >= 5 then
    insert into private.suspicious_activity_events (
      user_id, assignment_id, event_code, risk_level, sanitized_details
    ) values (
      new.user_id, new.assignment_id, 'repeated_collection_attempts', 'medium',
      jsonb_build_object('recentAttemptCount', v_recent_count + 1)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists flag_repeated_collection_attempts on private.location_verification_attempts;
create trigger flag_repeated_collection_attempts
after insert on private.location_verification_attempts
for each row execute function private.flag_repeated_collection_attempts();

create or replace function public.server_get_verified_daily_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress_id uuid := private.ensure_daily_progress(p_user_id, clock_timestamp());
  v_progress private.user_daily_progress%rowtype;
  v_config private.relic_server_config%rowtype;
  v_timezone_status text;
  v_current_window bigint;
begin
  perform private.recompute_daily_progress(v_progress_id);
  select * into strict v_progress from private.user_daily_progress where id = v_progress_id;
  select * into strict v_config from private.relic_server_config where singleton;
  select timezone_status into v_timezone_status from private.user_timezones where user_id = p_user_id;
  v_current_window := private.spawn_window_id(clock_timestamp(), v_config.spawn_window_minutes);

  return jsonb_build_object(
    'localDate', v_progress.local_date,
    'timezone', v_progress.timezone_name,
    'timezoneStatus', coalesce(v_timezone_status, 'fallback'),
    'verifiedDistanceMeters', v_progress.verified_distance_meters,
    'verifiedActiveSeconds', v_progress.verified_active_seconds,
    'verifiedSessionCount', v_progress.verified_session_count,
    'rare', jsonb_build_object(
      'thresholdMeters', v_config.rare_distance_meters,
      'earned', v_progress.rare_eligible,
      'active', v_progress.rare_effective_window_id is not null and v_current_window >= v_progress.rare_effective_window_id,
      'effectiveWindowId', v_progress.rare_effective_window_id
    ),
    'legendary', jsonb_build_object(
      'thresholdMeters', v_config.legendary_distance_meters,
      'earned', v_progress.legendary_eligible,
      'active', v_progress.legendary_effective_window_id is not null and v_current_window >= v_progress.legendary_effective_window_id,
      'effectiveWindowId', v_progress.legendary_effective_window_id
    ),
    'missionOverride', jsonb_build_object(
      'earned', v_progress.all_required_missions_completed,
      'active', v_progress.mission_override_effective_window_id is not null and v_current_window >= v_progress.mission_override_effective_window_id,
      'completedRequired', v_progress.completed_required_missions,
      'required', v_progress.required_missions
    ),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', completion.mission_id,
        'title', definition.title,
        'required', completion.is_required,
        'progress', completion.progress_value,
        'target', completion.target_value,
        'completed', completion.status = 'completed'
      ) order by definition.sort_order)
      from private.daily_mission_completion as completion
      join private.daily_mission_definitions as definition on definition.mission_id = completion.mission_id
      where completion.daily_progress_id = v_progress_id
    ), '[]'::jsonb),
    'eligibilityActivation', 'next_spawn_window',
    'serverTime', clock_timestamp()
  );
end;
$$;

-- Replace the Prompt 2 helper: it now selects today's server-derived local row and
-- applies threshold/mission unlocks only from their next 30-minute window.
create or replace function public.server_get_daily_eligibility(p_user_id uuid)
returns table (rare_eligible boolean, legendary_eligible boolean, mission_override boolean)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_context record;
  v_progress private.user_daily_progress%rowtype;
  v_config private.relic_server_config%rowtype;
  v_window bigint;
begin
  select * into strict v_context from private.user_local_context(p_user_id, clock_timestamp());
  select * into v_progress from private.user_daily_progress
    where user_id = p_user_id and local_date = v_context.local_date;
  select * into strict v_config from private.relic_server_config where singleton;
  v_window := private.spawn_window_id(clock_timestamp(), v_config.spawn_window_minutes);

  return query select
    coalesce(v_progress.rare_eligible and v_progress.rare_effective_window_id <= v_window, false),
    coalesce(v_progress.legendary_eligible and v_progress.legendary_effective_window_id <= v_window, false),
    coalesce(v_progress.all_required_missions_completed
      and v_progress.mission_override_effective_window_id <= v_window, false);
end;
$$;

alter table private.user_timezones enable row level security;
alter table private.distance_ingestion_batches enable row level security;
alter table private.movement_sample_evidence enable row level security;
alter table private.daily_mission_definitions enable row level security;

revoke all on private.user_timezones from public, anon, authenticated;
revoke all on private.distance_ingestion_batches from public, anon, authenticated;
revoke all on private.movement_sample_evidence from public, anon, authenticated;
revoke all on private.daily_mission_definitions from public, anon, authenticated;

revoke all on function public.server_set_user_timezone(uuid, text) from public, anon, authenticated;
revoke all on function public.server_begin_distance_batch(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.server_record_movement_evidence(uuid, uuid, text, text, timestamptz, double precision, double precision, double precision, double precision, boolean, text, text) from public, anon, authenticated;
revoke all on function public.server_record_verified_segment(uuid, uuid, text, text, text, double precision, timestamptz, timestamptz, integer, double precision) from public, anon, authenticated;
revoke all on function public.server_finish_distance_batch(uuid, uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.server_record_suspicious_event(uuid, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.server_get_verified_daily_progress(uuid) from public, anon, authenticated;

grant execute on function public.server_set_user_timezone(uuid, text) to service_role;
grant execute on function public.server_begin_distance_batch(uuid, text, text, integer) to service_role;
grant execute on function public.server_record_movement_evidence(uuid, uuid, text, text, timestamptz, double precision, double precision, double precision, double precision, boolean, text, text) to service_role;
grant execute on function public.server_record_verified_segment(uuid, uuid, text, text, text, double precision, timestamptz, timestamptz, integer, double precision) to service_role;
grant execute on function public.server_finish_distance_batch(uuid, uuid, integer, integer, text) to service_role;
grant execute on function public.server_record_suspicious_event(uuid, text, text, jsonb, uuid) to service_role;
grant execute on function public.server_get_verified_daily_progress(uuid) to service_role;

commit;
