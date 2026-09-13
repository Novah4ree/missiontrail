begin;

-- =========================================================
-- MISSION TRAILS
-- FOOD SORT PROGRESSION + SCORE FIX
-- =========================================================
--
-- Purpose:
-- 1. A legitimate fast win still completes the level.
-- 2. Completed levels advance to the next level.
-- 3. Food rewards can actually reach inventory.
-- 4. Every 100 game-score points = 2 Explorer Score points.
-- 5. Explorer Score feeds Profile + leaderboard progression.
-- =========================================================


-- We are replacing the old completion function.
drop function if exists
public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
);


create function
public.server_complete_food_sort_run(
  p_run_id uuid,
  p_score integer,
  p_moves_remaining integer
)
returns table (
  completed boolean,
  rewarded boolean,
  result_code text,
  explorer_points integer,
  carrot_quantity integer,
  treat_quantity integer,
  rewarded_wins_today integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_run
    private.food_sort_runs%rowtype;

  v_context record;

  v_previous_rewards integer := 0;

  v_companion_id text;

  -- Food Sort score conversion.
  v_raw_points integer := 0;
  v_points integer := 0;

  -- Existing Food Sort cap remains 500
  -- Explorer Score points per UTC day.
  v_points_today bigint := 0;
  v_cap_remaining integer := 0;

  v_period_start timestamptz;

  v_idempotency_key text;

  v_inserted_id uuid;
begin

  -- =======================================================
  -- LOGIN
  -- =======================================================

  if v_user_id is null then

    return query
    select
      false,
      false,
      'UNAUTHORIZED'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- =======================================================
  -- BASIC GAME VALUES
  -- =======================================================

  if
    p_score < 0
    or
    p_score > 10000000
    or
    p_moves_remaining < 0
    or
    p_moves_remaining > 20
  then

    return query
    select
      false,
      false,
      'INVALID_GAME_RESULT'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- =======================================================
  -- LOAD THIS RUN
  -- =======================================================

  select *
  into v_run
  from private.food_sort_runs
  where id =
    p_run_id
    and user_id =
      v_user_id
  for update;


  if not found then

    return query
    select
      false,
      false,
      'RUN_NOT_FOUND'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- Duplicate completion stays safe.
  if v_run.status = 'completed' then

    return query
    select
      true,
      v_run.rewarded,
      'ALREADY_COMPLETED'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  if v_run.status <> 'active' then

    return query
    select
      false,
      false,
      'RUN_NOT_ACTIVE'::text,
      0,
      0,
      0,
      0;

    return;

  end if;


  -- =======================================================
  -- IMPORTANT FIX
  --
  -- The old 15-second RUN_TOO_FAST rejection is removed.
  --
  -- A lucky cascade can legitimately finish a level fast.
  -- We can add stronger move replay validation later.
  -- =======================================================


  -- =======================================================
  -- COMPLETE THE LEVEL
  -- =======================================================
  --
  -- This status change fires the existing
  -- food_sort_advance_progress trigger.
  --
  -- Level 1 -> Level 2 -> Level 3 -> forever.
  -- =======================================================

  update private.food_sort_runs
  set
    status =
      'completed',

    score =
      p_score,

    moves_remaining =
      p_moves_remaining,

    completed_at =
      clock_timestamp(),

    updated_at =
      clock_timestamp()

  where id =
    v_run.id;


  -- =======================================================
  -- GAME SCORE -> EXPLORER SCORE
  --
  -- Every complete 100 game points = 2 leaderboard points.
  --
  -- Examples:
  -- 99   = 0
  -- 100  = 2
  -- 500  = 10
  -- 1260 = 24
  -- =======================================================

  v_raw_points :=
    floor(
      p_score::numeric /
      100
    )::integer
    * 2;


  v_period_start :=
    date_trunc(
      'day',
      clock_timestamp()
      at time zone 'UTC'
    )
    at time zone 'UTC';


  -- Count Food Sort Explorer points already
  -- earned today.
  select
    coalesce(
      sum(xp_delta),
      0
    )::bigint
  into
    v_points_today
  from private.xp_ledger
  where user_id =
    v_user_id
    and cap_group =
      'food_sort_daily'
    and created_at >=
      v_period_start;


  v_cap_remaining :=
    greatest(
      0,
      500 -
      v_points_today
    )::integer;


  v_points :=
    least(
      v_raw_points,
      v_cap_remaining
    );


  -- One score reward per completed run.
  v_idempotency_key :=
    concat(
      'food-sort-score:',
      v_run.id::text
    );


  if
    v_points > 0
    and not exists (
      select 1
      from private.xp_ledger
      where user_id =
        v_user_id
        and idempotency_key =
          v_idempotency_key
    )
  then

    insert into private.xp_ledger (
      user_id,
      source_type,
      source_id,
      xp_delta,
      idempotency_key,
      event_code,
      score_category,
      cap_group,
      metadata
    )
    values (
      v_user_id,

      'game',

      extensions.gen_random_uuid(),

      v_points,

      v_idempotency_key,

      'food_sort_score',

      'games',

      'food_sort_daily',

      jsonb_build_object(
        'game',
        'companion_food_sort',

        'level',
        v_run.level_number,

        'gameScore',
        p_score,

        'conversion',
        '100 game score = 2 Explorer Score',

        'movesRemaining',
        p_moves_remaining
      )
    )
    on conflict do nothing
    returning id
    into v_inserted_id;

  end if;


  -- =======================================================
  -- LOCAL DAY
  -- =======================================================

  select *
  into strict v_context
  from private.user_local_context(
    v_user_id,
    clock_timestamp()
  );


  -- Count previous free-item Food Sort wins today.
  select
    count(*)
  into
    v_previous_rewards
  from private.food_sort_runs
  where user_id =
    v_user_id
    and rewarded =
      true
    and id <>
      v_run.id
    and completed_at
      is not null
    and (
      completed_at
      at time zone
      v_context.timezone_name
    )::date =
      v_context.local_date;


  -- =======================================================
  -- AFTER 3 FREE-ITEM WINS
  --
  -- The player STILL:
  -- - completes the level
  -- - advances levels
  -- - earns score-based Explorer Score
  --
  -- They simply stop farming free food for the day.
  -- =======================================================

  if v_previous_rewards >= 3 then

    return query
    select
      true,
      false,
      'SCORE_ONLY'::text,
      v_points,
      0,
      0,
      v_previous_rewards;

    return;

  end if;


  -- =======================================================
  -- EMBER CARROT +1
  -- =======================================================

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'ember-carrot',
    1,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (
    user_id,
    food_id
  )
  do update set
    quantity =
      public.companion_food_inventory.quantity
      + 1,

    updated_at =
      clock_timestamp();


  insert into private.food_sort_reward_items (
    run_id,
    user_id,
    food_id,
    quantity
  )
  values (
    v_run.id,
    v_user_id,
    'ember-carrot',
    1
  )
  on conflict do nothing;


  -- =======================================================
  -- AURORA PUDDING +1
  -- =======================================================

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'aurora-pudding',
    1,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (
    user_id,
    food_id
  )
  do update set
    quantity =
      public.companion_food_inventory.quantity
      + 1,

    updated_at =
      clock_timestamp();


  insert into private.food_sort_reward_items (
    run_id,
    user_id,
    food_id,
    quantity
  )
  values (
    v_run.id,
    v_user_id,
    'aurora-pudding',
    1
  )
  on conflict do nothing;


  -- =======================================================
  -- COMPANION PLAY REWARD
  -- =======================================================

  perform
    private.refresh_companion_care(
      v_user_id
    );


  select
    companion_id
  into
    v_companion_id
  from private.user_companion_progress
  where user_id =
    v_user_id;


  if v_companion_id is not null then

    update private.user_companion_progress
    set
      bond_points =
        bond_points + 5,

      happiness =
        least(
          100,
          happiness + 5
        ),

      updated_at =
        clock_timestamp()

    where user_id =
      v_user_id;


    insert into private.companion_care_events (
      user_id,
      companion_id,
      event_type,
      happiness_change,
      bond_change
    )
    values (
      v_user_id,
      v_companion_id,
      'play',
      5,
      5
    );

  end if;


  -- Mark this run as one of today's
  -- free-item reward wins.
  update private.food_sort_runs
  set
    rewarded =
      true,

    updated_at =
      clock_timestamp()

  where id =
    v_run.id;


  return query
  select
    true,
    true,
    'REWARDED'::text,

    v_points,

    1,
    1,

    v_previous_rewards + 1;

end;
$$;


revoke all
on function
public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
from public, anon, authenticated;


grant execute
on function
public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
to authenticated;


commit;
