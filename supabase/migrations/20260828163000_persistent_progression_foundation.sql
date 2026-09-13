begin;

-- =========================================================
-- MISSION TRAILS PERMANENT PROGRESSION FOUNDATION
-- =========================================================
-- Purpose:
-- Adds permanent missions, lifetime steps, weekly step totals,
-- personal step records, leaderboard score breakdowns,
-- and Egg Hunt unlocks.
--
-- Today's steps still use a date.
-- Permanent mission progress NEVER resets at midnight.
-- =========================================================


-- =========================================================
-- 1. ACTUAL DAILY STEP HISTORY
-- =========================================================

create table if not exists private.activity_daily_steps (
  user_id uuid not null
    references auth.users(id) on delete cascade,

  local_date date not null,

  step_count integer not null default 0
    check (step_count between 0 and 100000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, local_date)
);

create index if not exists activity_daily_steps_user_date_idx
  on private.activity_daily_steps (
    user_id,
    local_date desc
  );


-- =========================================================
-- 2. LIFETIME PLAYER PROGRESSION
-- =========================================================

create table if not exists private.user_progression_totals (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  lifetime_steps bigint not null default 0
    check (lifetime_steps >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- 3. 10,000 PERMANENT MISSIONS
-- =========================================================
--
-- Mission #1 = 500 steps
-- Every following mission adds 10 more required steps.
--
-- Examples:
--
-- #1     = 500
-- #100   = 1,490
-- #500   = 5,490
-- #1,000 = 10,490
-- #5,000 = 50,490
-- #10,000 = 100,490
--
-- This gives us thousands of increasingly difficult missions
-- without asking someone to walk 900 miles for Mission #73.
-- =========================================================

create table if not exists private.progression_mission_catalog (
  mission_number integer primary key
    check (mission_number >= 1),

  title text not null,

  tier text not null
    check (
      tier in (
        'explorer',
        'pathfinder',
        'trailblazer',
        'adventurer',
        'elite',
        'master',
        'legendary',
        'mythic'
      )
    ),

  metric text not null default 'verified_steps',

  target_value bigint not null
    check (target_value > 0),

  mission_points integer not null
    check (mission_points >= 0),

  egg_hunt_reward boolean not null default false,

  is_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Purpose:
-- Creates 10,000 missions automatically.
insert into private.progression_mission_catalog (
  mission_number,
  title,
  tier,
  metric,
  target_value,
  mission_points,
  egg_hunt_reward
)
select
  mission_number,

  (
    case
      when mission_number <= 25 then 'Explorer'
      when mission_number <= 100 then 'Pathfinder'
      when mission_number <= 250 then 'Trailblazer'
      when mission_number <= 500 then 'Adventurer'
      when mission_number <= 1000 then 'Elite'
      when mission_number <= 2500 then 'Master'
      when mission_number <= 5000 then 'Legendary'
      else 'Mythic'
    end
    || ' Mission '
    || mission_number
    || ': Walk '
    || (500 + ((mission_number - 1) * 10))
    || ' Steps'
  ),

  case
    when mission_number <= 25 then 'explorer'
    when mission_number <= 100 then 'pathfinder'
    when mission_number <= 250 then 'trailblazer'
    when mission_number <= 500 then 'adventurer'
    when mission_number <= 1000 then 'elite'
    when mission_number <= 2500 then 'master'
    when mission_number <= 5000 then 'legendary'
    else 'mythic'
  end,

  'verified_steps',

  500 + ((mission_number - 1) * 10),

  50 + (
    floor((mission_number - 1)::numeric / 25) * 10
  )::integer,

  -- Every 25th mission currently awards an Egg Hunt.
  -- This can be rebalanced later without changing user progress.
  mission_number % 25 = 0

from generate_series(1, 10000) as mission_number

on conflict (mission_number)
do update set
  title = excluded.title,
  tier = excluded.tier,
  metric = excluded.metric,
  target_value = excluded.target_value,
  mission_points = excluded.mission_points,
  egg_hunt_reward = excluded.egg_hunt_reward,
  updated_at = clock_timestamp();


-- =========================================================
-- 4. EACH USER'S PERMANENT MISSION PROGRESS
-- =========================================================

create table if not exists private.user_progression_missions (
  id uuid primary key default extensions.gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  mission_number integer not null
    references private.progression_mission_catalog(mission_number),

  progress_value bigint not null default 0
    check (progress_value >= 0),

  status text not null default 'active'
    check (
      status in (
        'active',
        'completed'
      )
    ),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, mission_number)
);


-- A player can only have one current active sequential mission.
create unique index if not exists
  user_progression_one_active_mission_idx
on private.user_progression_missions (user_id)
where status = 'active';


create index if not exists
  user_progression_missions_history_idx
on private.user_progression_missions (
  user_id,
  mission_number desc
);


-- =========================================================
-- 5. EGG HUNT UNLOCK LEDGER
-- =========================================================
--
-- Eggs are NOT placed in inventory here.
--
-- This table means:
-- "The player earned the right to go FIND an egg."
--
-- Later:
-- available
--    ↓
-- spawned on map
--    ↓
-- AR search
--    ↓
-- collected
-- =========================================================

create table if not exists private.egg_hunt_unlocks (
  id uuid primary key default extensions.gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  source_type text not null
    check (
      source_type in (
        'steps',
        'mission'
      )
    ),

  source_key text not null,

  milestone_steps bigint,

  mission_number integer,

  status text not null default 'available'
    check (
      status in (
        'available',
        'spawned',
        'collected'
      )
    ),

  created_at timestamptz not null default now(),
  spawned_at timestamptz,
  collected_at timestamptz,

  unique (
    user_id,
    source_type,
    source_key
  )
);


create index if not exists egg_hunt_unlocks_available_idx
  on private.egg_hunt_unlocks (
    user_id,
    created_at
  )
  where status = 'available';


-- =========================================================
-- 6. PRESERVE STEP HISTORY WE ALREADY HAVE
-- =========================================================
--
-- Existing device step rows give us a minimum historical
-- starting point instead of resetting everybody to zero.
-- =========================================================

insert into private.activity_daily_steps (
  user_id,
  local_date,
  step_count,
  created_at,
  updated_at
)
select
  user_id,
  local_date,
  step_count,
  created_at,
  updated_at
from private.device_daily_steps

on conflict (user_id, local_date)
do update set
  step_count = greatest(
    private.activity_daily_steps.step_count,
    excluded.step_count
  ),
  updated_at = clock_timestamp();


-- Purpose:
-- Backfills lifetime steps from stored day totals.
insert into private.user_progression_totals (
  user_id,
  lifetime_steps
)
select
  user_id,
  sum(step_count)::bigint
from private.activity_daily_steps
group by user_id

on conflict (user_id)
do update set
  lifetime_steps = greatest(
    private.user_progression_totals.lifetime_steps,
    excluded.lifetime_steps
  ),
  updated_at = clock_timestamp();


-- =========================================================
-- 7. MAKE SURE A PLAYER HAS A CURRENT MISSION
-- =========================================================

create or replace function private.ensure_progression_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_mission integer;
begin

  insert into private.user_progression_totals (
    user_id,
    lifetime_steps
  )
  values (
    p_user_id,
    0
  )
  on conflict (user_id) do nothing;


  -- Do nothing if this user already has an active mission.
  if exists (
    select 1
    from private.user_progression_missions
    where user_id = p_user_id
      and status = 'active'
  ) then
    return;
  end if;


  -- Continue after the player's highest completed mission.
  select
    coalesce(max(mission_number), 0) + 1
  into v_next_mission
  from private.user_progression_missions
  where user_id = p_user_id
    and status = 'completed';


  -- Activate the next mission if one exists.
  insert into private.user_progression_missions (
    user_id,
    mission_number,
    progress_value,
    status
  )
  select
    p_user_id,
    catalog.mission_number,
    0,
    'active'
  from private.progression_mission_catalog as catalog
  where catalog.mission_number = v_next_mission
    and catalog.is_enabled
  on conflict (user_id, mission_number) do nothing;

end;
$$;


-- =========================================================
-- 8. RETURN THE PLAYER'S NEW PROGRESSION SUMMARY
-- =========================================================

create or replace function public.server_get_progression_summary(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_week_start date;

  v_today_steps bigint := 0;
  v_weekly_steps bigint := 0;
  v_lifetime_steps bigint := 0;

  v_best_steps bigint := 0;
  v_best_date date;

  v_mission_points bigint := 0;
  v_game_points bigint := 0;
  v_step_points bigint := 0;
  v_overall_points bigint := 0;

  v_available_egg_hunts integer := 0;

  v_current_mission jsonb := null;
begin

  perform private.ensure_progression_user(p_user_id);


  select *
  into strict v_context
  from private.user_local_context(
    p_user_id,
    clock_timestamp()
  );


  -- Monday is the beginning of the Mission Trails week.
  v_week_start :=
    v_context.local_date
    - (
        extract(
          isodow from v_context.local_date
        )::integer - 1
      );


  select coalesce(step_count, 0)
  into v_today_steps
  from private.activity_daily_steps
  where user_id = p_user_id
    and local_date = v_context.local_date;


  v_today_steps := coalesce(v_today_steps, 0);


  select coalesce(sum(step_count), 0)
  into v_weekly_steps
  from private.activity_daily_steps
  where user_id = p_user_id
    and local_date between
      v_week_start
      and v_week_start + 6;


  select lifetime_steps
  into v_lifetime_steps
  from private.user_progression_totals
  where user_id = p_user_id;


  v_lifetime_steps := coalesce(v_lifetime_steps, 0);


  -- 100 lifetime verified steps = 1 leaderboard point.
  v_step_points :=
    floor(v_lifetime_steps::numeric / 100)::bigint;


  -- Mission Points use the existing secure XP ledger.
  select
    coalesce(
      sum(xp_delta)
      filter (
        where source_type = 'mission'
      ),
      0
    )::bigint,

    coalesce(
      sum(xp_delta)
      filter (
        where source_type = 'game'
      ),
      0
    )::bigint

  into
    v_mission_points,
    v_game_points

  from private.xp_ledger
  where user_id = p_user_id;


  v_overall_points :=
    v_mission_points
    + v_game_points
    + v_step_points;


  select
    step_count,
    local_date
  into
    v_best_steps,
    v_best_date
  from private.activity_daily_steps
  where user_id = p_user_id
  order by
    step_count desc,
    local_date asc
  limit 1;


  v_best_steps := coalesce(v_best_steps, 0);


  select count(*)::integer
  into v_available_egg_hunts
  from private.egg_hunt_unlocks
  where user_id = p_user_id
    and status = 'available';


  select jsonb_build_object(
    'missionNumber',
      progress.mission_number,

    'title',
      catalog.title,

    'tier',
      catalog.tier,

    'metric',
      catalog.metric,

    'progress',
      progress.progress_value,

    'target',
      catalog.target_value,

    'missionPoints',
      catalog.mission_points,

    'eggHuntReward',
      catalog.egg_hunt_reward,

    'status',
      progress.status
  )
  into v_current_mission

  from private.user_progression_missions as progress

  join private.progression_mission_catalog as catalog
    on catalog.mission_number =
       progress.mission_number

  where progress.user_id = p_user_id
    and progress.status = 'active'

  limit 1;


  return jsonb_build_object(

    'daily',
      jsonb_build_object(
        'date',
          v_context.local_date,
        'steps',
          v_today_steps
      ),

    'weekly',
      jsonb_build_object(
        'weekStart',
          v_week_start,
        'steps',
          v_weekly_steps
      ),

    'lifetime',
      jsonb_build_object(
        'steps',
          v_lifetime_steps
      ),

    'personalRecord',
      jsonb_build_object(
        'highestDailySteps',
          v_best_steps,
        'date',
          v_best_date
      ),

    'scores',
      jsonb_build_object(
        'missionPoints',
          v_mission_points,
        'gamePoints',
          v_game_points,
        'stepPoints',
          v_step_points,
        'overallPoints',
          v_overall_points
      ),

    'eggHuntsAvailable',
      v_available_egg_hunts,

    'currentMission',
      v_current_mission

  );
end;
$$;


-- =========================================================
-- 9. RECORD AN ABSOLUTE DAILY STEP SNAPSHOT
-- =========================================================
--
-- IMPORTANT:
-- The phone sends:
--
-- "I have 4,821 steps today."
--
-- NOT:
--
-- "Add 4,821 more steps."
--
-- This prevents duplicate sync requests from duplicating
-- lifetime steps, mission progress, points, or Egg Hunts.
-- =========================================================

create or replace function public.server_record_activity_steps(
  p_user_id uuid,
  p_local_date date,
  p_steps integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;

  v_old_daily_steps bigint := 0;
  v_new_daily_steps bigint := 0;
  v_delta bigint := 0;

  v_old_lifetime bigint := 0;
  v_new_lifetime bigint := 0;

  v_remaining bigint := 0;
  v_needed bigint := 0;
  v_applied bigint := 0;

  v_mission record;
begin

  if p_user_id is null then
    raise exception 'user_id_required';
  end if;


  if p_steps < 0
     or p_steps > 100000 then
    raise exception 'invalid_step_count';
  end if;


  select *
  into strict v_context
  from private.user_local_context(
    p_user_id,
    clock_timestamp()
  );


  -- A phone cannot submit today's steps for some random day.
  if p_local_date <> v_context.local_date then
    raise exception 'invalid_local_date';
  end if;


  perform private.ensure_progression_user(p_user_id);


  -- Make sure today's row exists before locking it.
  insert into private.activity_daily_steps (
    user_id,
    local_date,
    step_count
  )
  values (
    p_user_id,
    p_local_date,
    0
  )
  on conflict (user_id, local_date) do nothing;


  -- Lock this user's day so two simultaneous requests
  -- cannot duplicate progress.
  select step_count
  into v_old_daily_steps
  from private.activity_daily_steps
  where user_id = p_user_id
    and local_date = p_local_date
  for update;


  v_new_daily_steps :=
    greatest(
      v_old_daily_steps,
      p_steps
    );


  v_delta :=
    v_new_daily_steps
    - v_old_daily_steps;


  update private.activity_daily_steps
  set
    step_count = v_new_daily_steps,
    updated_at = clock_timestamp()
  where user_id = p_user_id
    and local_date = p_local_date;


  -- Lock lifetime totals for this player.
  select lifetime_steps
  into v_old_lifetime
  from private.user_progression_totals
  where user_id = p_user_id
  for update;


  if v_delta > 0 then

    update private.user_progression_totals
    set
      lifetime_steps =
        lifetime_steps + v_delta,

      updated_at =
        clock_timestamp()

    where user_id = p_user_id

    returning lifetime_steps
    into v_new_lifetime;

  else

    v_new_lifetime :=
      v_old_lifetime;

  end if;


  -- =======================================================
  -- EGG HUNT STEP MILESTONES
  -- =======================================================

  -- First Egg Hunt at 500 lifetime steps.
  if
    v_old_lifetime < 500
    and
    v_new_lifetime >= 500
  then

    insert into private.egg_hunt_unlocks (
      user_id,
      source_type,
      source_key,
      milestone_steps
    )
    values (
      p_user_id,
      'steps',
      'steps:500',
      500
    )
    on conflict (
      user_id,
      source_type,
      source_key
    )
    do nothing;

  end if;


  -- Every additional Egg Hunt at:
  --
  -- 5,000
  -- 10,000
  -- 15,000
  -- 20,000
  -- etc.
  insert into private.egg_hunt_unlocks (
    user_id,
    source_type,
    source_key,
    milestone_steps
  )

  select
    p_user_id,
    'steps',
    'steps:' || milestone_steps,
    milestone_steps

  from generate_series(
    5000::bigint,
    v_new_lifetime,
    5000::bigint
  ) as milestone_steps

  where milestone_steps > v_old_lifetime

  on conflict (
    user_id,
    source_type,
    source_key
  )
  do nothing;


  -- =======================================================
  -- PERMANENT MISSION PROGRESS
  -- =======================================================
  --
  -- Consume only the NEW steps.
  --
  -- If someone walks enough to finish one mission and begin
  -- another before the next server sync, the leftover steps
  -- continue into the next mission.
  -- =======================================================

  v_remaining := v_delta;


  while v_remaining > 0 loop

    perform private.ensure_progression_user(p_user_id);


    select
      progress.id,
      progress.mission_number,
      progress.progress_value,
      catalog.target_value,
      catalog.metric,
      catalog.mission_points,
      catalog.egg_hunt_reward

    into v_mission

    from private.user_progression_missions as progress

    join private.progression_mission_catalog as catalog
      on catalog.mission_number =
         progress.mission_number

    where progress.user_id = p_user_id
      and progress.status = 'active'

    order by progress.mission_number

    limit 1

    for update of progress;


    -- The user completed every mission we currently have.
    if not found then
      exit;
    end if;


    -- v1 missions are step missions.
    -- Later mission types will use the same persistent table.
    if v_mission.metric <> 'verified_steps' then
      exit;
    end if;


    v_needed :=
      greatest(
        0,
        v_mission.target_value
          - v_mission.progress_value
      );


    v_applied :=
      least(
        v_remaining,
        v_needed
      );


    update private.user_progression_missions
    set
      progress_value =
        progress_value + v_applied,

      updated_at =
        clock_timestamp()

    where id =
      v_mission.id;


    v_remaining :=
      v_remaining - v_applied;


    -- Mission finished.
    if
      v_mission.progress_value
      + v_applied
      >= v_mission.target_value
    then

      update private.user_progression_missions
      set
        progress_value =
          v_mission.target_value,

        status =
          'completed',

        completed_at =
          coalesce(
            completed_at,
            clock_timestamp()
          ),

        updated_at =
          clock_timestamp()

      where id =
        v_mission.id;


      -- Award permanent Mission Points using the
      -- existing secure XP ledger.
      insert into private.xp_ledger (
        user_id,
        source_type,
        source_id,
        xp_delta,
        idempotency_key,
        event_code,
        score_category,
        metadata
      )
      values (
        p_user_id,
        'mission',
        v_mission.id,
        v_mission.mission_points,

        'progression-mission:'
          || p_user_id
          || ':'
          || v_mission.mission_number,

        'progression_mission_complete',

        'missions',

        jsonb_build_object(
          'missionNumber',
            v_mission.mission_number,

          'targetSteps',
            v_mission.target_value
        )
      )
      on conflict do nothing;


      -- Some missions unlock an Egg Hunt.
      -- They still DO NOT place an egg directly in inventory.
      if v_mission.egg_hunt_reward then

        insert into private.egg_hunt_unlocks (
          user_id,
          source_type,
          source_key,
          mission_number
        )
        values (
          p_user_id,
          'mission',
          'mission:' || v_mission.mission_number,
          v_mission.mission_number
        )
        on conflict (
          user_id,
          source_type,
          source_key
        )
        do nothing;

      end if;


      -- Activate the next mission immediately.
      insert into private.user_progression_missions (
        user_id,
        mission_number,
        progress_value,
        status
      )

      select
        p_user_id,
        catalog.mission_number,
        0,
        'active'

      from private.progression_mission_catalog as catalog

      where catalog.mission_number =
        v_mission.mission_number + 1

        and catalog.is_enabled

      on conflict (
        user_id,
        mission_number
      )
      do nothing;


    else

      -- Current mission still needs more steps.
      exit;

    end if;

  end loop;


  return public.server_get_progression_summary(
    p_user_id
  );

end;
$$;


-- =========================================================
-- 10. SECURITY
-- =========================================================
--
-- The mobile phone does not get direct write access.
-- Our authenticated Edge Function will call these as
-- service_role after verifying the signed-in user.
-- =========================================================

revoke all
on function public.server_record_activity_steps(
  uuid,
  date,
  integer
)
from public, anon, authenticated;


revoke all
on function public.server_get_progression_summary(
  uuid
)
from public, anon, authenticated;


grant execute
on function public.server_record_activity_steps(
  uuid,
  date,
  integer
)
to service_role;


grant execute
on function public.server_get_progression_summary(
  uuid
)
to service_role;


commit;
