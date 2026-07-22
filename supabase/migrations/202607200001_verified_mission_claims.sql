begin;

-- Mission states are one-way. Only service-role functions below can move a row
-- from active to completed or from completed to claimed.
alter table private.daily_mission_completion
  drop constraint if exists daily_mission_completion_status_check;
update private.daily_mission_completion set status = 'active' where status = 'in_progress';
alter table private.daily_mission_completion
  add constraint daily_mission_completion_status_check
  check (status in ('locked', 'active', 'completed', 'claimed', 'expired'));
alter table private.daily_mission_completion alter column status set default 'active';

alter table private.daily_mission_completion
  add column if not exists claimed_at timestamptz,
  add column if not exists xp_awarded integer not null default 0 check (xp_awarded >= 0);

alter table private.daily_mission_completion
  drop constraint if exists daily_mission_completion_check;
alter table private.daily_mission_completion
  add constraint daily_mission_completion_completion_check check (
    (status in ('completed', 'claimed') and completed_at is not null)
    or status not in ('completed', 'claimed')
  );
alter table private.daily_mission_completion
  add constraint daily_mission_completion_claim_check check (
    (status = 'claimed' and claimed_at is not null) or status <> 'claimed'
  );

alter table private.daily_mission_definitions
  drop constraint if exists daily_mission_definitions_metric_check;
alter table private.daily_mission_definitions
  add constraint daily_mission_definitions_metric_check check (metric in (
    'verified_distance_meters', 'verified_active_seconds', 'verified_session_count',
    'verified_steps', 'verified_relic_collections', 'verified_location_entries',
    'verified_daily_set'
  ));
alter table private.daily_mission_definitions
  add column if not exists reward_xp integer not null default 50 check (reward_xp >= 0);

-- The visible walking example is now a real three-mile GPS requirement.
delete from private.daily_mission_completion where mission_id = 'verified-walk-one-mile';
delete from private.daily_mission_definitions where mission_id = 'verified-walk-one-mile';
insert into private.daily_mission_definitions (
  mission_id, title, metric, target_value, is_required, sort_order, reward_xp
) values (
  'verified-walk-three-miles', 'Walk 3 Miles', 'verified_distance_meters', 4828.032, true, 10, 100
)
on conflict (mission_id) do update set
  title = excluded.title,
  metric = excluded.metric,
  target_value = excluded.target_value,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order,
  reward_xp = excluded.reward_xp,
  updated_at = clock_timestamp();

-- The Edge Function calls this before accepting movement. No active mission means
-- GPS may still draw the map, but it cannot increase mission distance.
create or replace function public.server_has_active_mission(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_progress_id uuid;
begin
  v_progress_id := private.ensure_daily_progress(p_user_id, clock_timestamp());
  return exists (
    select 1 from private.daily_mission_completion
    where daily_progress_id = v_progress_id and status = 'active'
  );
end;
$$;

-- Awards XP once, inside the same database transaction that changes the state.
-- The caller supplies only an ID; progress, target, state, and XP all come from
-- private server tables.
create or replace function public.server_claim_mission_reward(
  p_user_id uuid,
  p_mission_id text
)
returns table (claimed boolean, result_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress_id uuid;
  v_completion private.daily_mission_completion%rowtype;
  v_reward integer;
  v_updated integer;
begin
  v_progress_id := private.ensure_daily_progress(p_user_id, clock_timestamp());
  perform private.recompute_daily_progress(v_progress_id);

  select completion.*
  into v_completion
  from private.daily_mission_completion as completion
  where completion.daily_progress_id = v_progress_id
    and completion.mission_id = p_mission_id
  for update of completion;

  if not found then return query select false, 'MISSION_NOT_FOUND'; return; end if;
  if v_completion.status = 'claimed' then return query select false, 'ALREADY_CLAIMED'; return; end if;
  if v_completion.status <> 'completed' then return query select false, 'REQUIREMENT_NOT_MET'; return; end if;

  select reward_xp into strict v_reward
  from private.daily_mission_definitions where mission_id = v_completion.mission_id;

  insert into private.xp_ledger (user_id, source_type, source_id, xp_delta)
  values (p_user_id, 'mission', v_completion.id, v_reward)
  on conflict (user_id, source_type, source_id) do nothing;

  update private.daily_mission_completion
  set status = 'claimed', claimed_at = clock_timestamp(), xp_awarded = v_reward,
      updated_at = clock_timestamp()
  where id = v_completion.id and status = 'completed';
  get diagnostics v_updated = row_count;

  return query select v_updated = 1,
    case when v_updated = 1 then 'CLAIMED' else 'ALREADY_CLAIMED' end;
end;
$$;

-- Preserve claimed rows while verified evidence is recalculated. A claim can
-- never be undone by refresh, retry, or a duplicate GPS batch.
create or replace function private.recompute_daily_progress(p_progress_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.relic_server_config%rowtype;
  v_daily private.user_daily_progress%rowtype;
  v_distance numeric;
  v_seconds integer;
  v_sessions integer;
  v_relics integer;
  v_locations integer;
  v_required integer;
  v_completed integer;
  v_override boolean;
  v_next_window bigint;
begin
  perform 1 from private.user_daily_progress where id = p_progress_id for update;
  select * into strict v_config from private.relic_server_config where singleton;
  select * into strict v_daily from private.user_daily_progress where id = p_progress_id;

  select coalesce(sum(accepted_distance_meters), 0),
         coalesce(sum(duration_seconds), 0),
         count(distinct ingestion_batch_id)
  into v_distance, v_seconds, v_sessions
  from private.verified_distance_snapshots
  where daily_progress_id = p_progress_id and verification_status = 'accepted';

  -- Relics count only after the secure proximity flow inserted the collection.
  select count(*) into v_relics
  from public.user_relic_collections
  where user_id = v_daily.user_id
    and (collected_at at time zone v_daily.timezone_name)::date = v_daily.local_date;

  -- Location missions count only server-verified zone entries, never a client tap.
  select count(distinct coalesce(assignment_id, id)) into v_locations
  from private.location_verification_attempts
  where user_id = v_daily.user_id
    and status = 'verified'
    and purpose in ('zone_anchor', 'reveal', 'collection')
    and (verified_at at time zone v_daily.timezone_name)::date = v_daily.local_date;

  update private.daily_mission_completion as completion
  set progress_value = case definition.metric
        when 'verified_distance_meters' then v_distance
        when 'verified_active_seconds' then v_seconds
        when 'verified_session_count' then v_sessions
        when 'verified_relic_collections' then v_relics
        when 'verified_location_entries' then v_locations
        else completion.progress_value
      end,
      status = case
        when completion.status in ('locked', 'claimed') then completion.status
        when case definition.metric
          when 'verified_distance_meters' then v_distance
          when 'verified_active_seconds' then v_seconds
          when 'verified_session_count' then v_sessions
          when 'verified_relic_collections' then v_relics
          when 'verified_location_entries' then v_locations
          else completion.progress_value
        end >= completion.target_value then 'completed'
        else 'active'
      end,
      completed_at = case
        when completion.status = 'claimed' then completion.completed_at
        when case definition.metric
          when 'verified_distance_meters' then v_distance
          when 'verified_active_seconds' then v_seconds
          when 'verified_session_count' then v_sessions
          when 'verified_relic_collections' then v_relics
          when 'verified_location_entries' then v_locations
          else completion.progress_value
        end >= completion.target_value then coalesce(completion.completed_at, clock_timestamp())
        else null
      end,
      updated_at = clock_timestamp()
  from private.daily_mission_definitions as definition
  where completion.daily_progress_id = p_progress_id
    and definition.mission_id = completion.mission_id;

  -- A daily-set row is evaluated last so every required evidence-based mission
  -- has already reached its server-derived state.
  update private.daily_mission_completion as completion
  set progress_value = case when not exists (
        select 1
        from private.daily_mission_completion as required_completion
        join private.daily_mission_definitions as required_definition
          on required_definition.mission_id = required_completion.mission_id
        where required_completion.daily_progress_id = p_progress_id
          and required_completion.is_required
          and required_definition.metric <> 'verified_daily_set'
          and required_completion.status not in ('completed', 'claimed')
      ) then completion.target_value else 0 end,
      status = case
        when completion.status in ('locked', 'claimed') then completion.status
        when not exists (
          select 1
          from private.daily_mission_completion as required_completion
          join private.daily_mission_definitions as required_definition
            on required_definition.mission_id = required_completion.mission_id
          where required_completion.daily_progress_id = p_progress_id
            and required_completion.is_required
            and required_definition.metric <> 'verified_daily_set'
            and required_completion.status not in ('completed', 'claimed')
        ) then 'completed' else 'active' end,
      completed_at = case when not exists (
        select 1
        from private.daily_mission_completion as required_completion
        join private.daily_mission_definitions as required_definition
          on required_definition.mission_id = required_completion.mission_id
        where required_completion.daily_progress_id = p_progress_id
          and required_completion.is_required
          and required_definition.metric <> 'verified_daily_set'
          and required_completion.status not in ('completed', 'claimed')
      ) then coalesce(completion.completed_at, clock_timestamp()) else null end,
      updated_at = clock_timestamp()
  from private.daily_mission_definitions as definition
  where completion.daily_progress_id = p_progress_id
    and definition.mission_id = completion.mission_id
    and definition.metric = 'verified_daily_set';

  select count(*) filter (where is_required),
         count(*) filter (where is_required and status in ('completed', 'claimed'))
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

-- Add state and reward data to the existing safe progress response.
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
    'rare', jsonb_build_object('thresholdMeters', v_config.rare_distance_meters,
      'earned', v_progress.rare_eligible,
      'active', v_progress.rare_effective_window_id is not null and v_current_window >= v_progress.rare_effective_window_id,
      'effectiveWindowId', v_progress.rare_effective_window_id),
    'legendary', jsonb_build_object('thresholdMeters', v_config.legendary_distance_meters,
      'earned', v_progress.legendary_eligible,
      'active', v_progress.legendary_effective_window_id is not null and v_current_window >= v_progress.legendary_effective_window_id,
      'effectiveWindowId', v_progress.legendary_effective_window_id),
    'missionOverride', jsonb_build_object('earned', v_progress.all_required_missions_completed,
      'active', v_progress.mission_override_effective_window_id is not null and v_current_window >= v_progress.mission_override_effective_window_id,
      'completedRequired', v_progress.completed_required_missions, 'required', v_progress.required_missions),
    'missions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', completion.mission_id, 'title', definition.title,
      'required', completion.is_required, 'state', completion.status,
      'requirementType', case definition.metric
        when 'verified_distance_meters' then 'distance'
        when 'verified_steps' then 'steps'
        when 'verified_relic_collections' then 'relic'
        when 'verified_location_entries' then 'location'
        when 'verified_daily_set' then 'daily_set'
        when 'verified_active_seconds' then 'active_time'
        when 'verified_session_count' then 'session'
        else 'distance' end,
      'progress', completion.progress_value, 'target', completion.target_value,
      'completed', completion.status in ('completed', 'claimed'),
      'rewardXp', definition.reward_xp, 'claimedAt', completion.claimed_at
    ) order by definition.sort_order)
      from private.daily_mission_completion as completion
      join private.daily_mission_definitions as definition on definition.mission_id = completion.mission_id
      where completion.daily_progress_id = v_progress_id), '[]'::jsonb),
    'eligibilityActivation', 'next_spawn_window', 'serverTime', clock_timestamp()
  );
end;
$$;

revoke all on function public.server_has_active_mission(uuid) from public, anon, authenticated;
revoke all on function public.server_claim_mission_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.server_has_active_mission(uuid) to service_role;
grant execute on function public.server_claim_mission_reward(uuid, text) to service_role;

commit;
