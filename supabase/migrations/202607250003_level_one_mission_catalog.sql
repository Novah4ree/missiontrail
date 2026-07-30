begin;

-- Mission definitions own level membership. User completion rows only store
-- that user's verified progress and never decide whether a mission is visible.
alter table private.daily_mission_definitions
  add column if not exists mission_level integer not null default 1
  check (mission_level >= 1);

update private.daily_mission_definitions
set mission_level = 1
where mission_level is null;

-- Seed beginner missions only when the project genuinely has no enabled Level
-- 1 catalog. This guard makes the migration safe to run more than once and
-- preserves the existing Mission Trails mission names when they already exist.
do $$
begin
  if not exists (
    select 1
    from private.daily_mission_definitions
    where mission_level = 1 and is_enabled
  ) then
    insert into private.daily_mission_definitions (
      mission_id, title, metric, target_value, is_required,
      is_enabled, sort_order, reward_xp, mission_level
    ) values
      ('level-1-walk-1000-steps', 'Walk 1,000 Steps', 'verified_steps', 1000, true, true, 10, 50, 1),
      ('level-1-walk-half-mile', 'Walk 0.5 Miles', 'verified_distance_meters', 804.672, true, true, 20, 50, 1),
      ('level-1-explore-ten-minutes', 'Explore for 10 Minutes', 'verified_active_seconds', 600, true, true, 30, 50, 1),
      ('level-1-visit-location', 'Visit One New Location', 'verified_location_entries', 1, true, true, 40, 50, 1),
      ('level-1-discover-relic', 'Discover One Relic', 'verified_relic_collections', 1, true, true, 50, 50, 1)
    on conflict (mission_id) do nothing;
  end if;
end;
$$;

-- This trusted function joins the catalog to today's per-user rows. A missing
-- progress row is created at zero by ensure_daily_progress instead of removing
-- the definition from the result.
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
      'active', v_progress.rare_effective_window_id is not null
        and v_current_window >= v_progress.rare_effective_window_id,
      'effectiveWindowId', v_progress.rare_effective_window_id
    ),
    'legendary', jsonb_build_object(
      'thresholdMeters', v_config.legendary_distance_meters,
      'earned', v_progress.legendary_eligible,
      'active', v_progress.legendary_effective_window_id is not null
        and v_current_window >= v_progress.legendary_effective_window_id,
      'effectiveWindowId', v_progress.legendary_effective_window_id
    ),
    'missionOverride', jsonb_build_object(
      'earned', v_progress.all_required_missions_completed,
      'active', v_progress.mission_override_effective_window_id is not null
        and v_current_window >= v_progress.mission_override_effective_window_id,
      'completedRequired', v_progress.completed_required_missions,
      'required', v_progress.required_missions
    ),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', completion.mission_id,
        'level', definition.mission_level,
        'title', definition.title,
        'required', completion.is_required,
        'state', completion.status,
        'requirementType', case definition.metric
          when 'verified_distance_meters' then 'distance'
          when 'verified_steps' then 'steps'
          when 'verified_relic_collections' then 'relic'
          when 'verified_location_entries' then 'location'
          when 'verified_daily_set' then 'daily_set'
          when 'verified_active_seconds' then 'active_time'
          when 'verified_session_count' then 'session'
          else 'distance'
        end,
        'progress', completion.progress_value,
        'target', completion.target_value,
        'completed', completion.status in ('completed', 'claimed'),
        'rewardXp', definition.reward_xp,
        'claimedAt', completion.claimed_at
      ) order by definition.sort_order)
      from private.daily_mission_completion as completion
      join private.daily_mission_definitions as definition
        on definition.mission_id = completion.mission_id
      where completion.daily_progress_id = v_progress_id
        and definition.is_enabled
    ), '[]'::jsonb),
    'eligibilityActivation', 'next_spawn_window',
    'serverTime', clock_timestamp()
  );
end;
$$;

revoke all on function public.server_get_verified_daily_progress(uuid)
  from public, anon, authenticated;
grant execute on function public.server_get_verified_daily_progress(uuid) to service_role;

commit;
