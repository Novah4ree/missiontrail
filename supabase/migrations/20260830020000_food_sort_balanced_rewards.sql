begin;

-- ============================================================
-- FOOD SORT BALANCED, IDEMPOTENT INVENTORY REWARDS
-- ============================================================
-- First clear: one guaranteed small catalog reward.
-- Milestone first clear: improved rarity; common/uncommon x2.
-- Replay: 35% chance for one item with strongly reduced rarity.
-- All paths retain the existing three rewarded runs/day cap.
-- ============================================================

drop function if exists public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
);

create function public.server_complete_food_sort_run(
  p_run_id uuid,
  p_score integer,
  p_moves_remaining integer
)
returns table (
  completed boolean,
  rewarded boolean,
  result_code text,
  explorer_points integer,
  reward_food_id text,
  reward_food_name text,
  reward_quantity integer,
  rewarded_wins_today integer,
  reward_kind text,
  reward_rarity text,
  first_clear boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run private.food_sort_runs%rowtype;
  v_context record;
  v_previous_rewards integer := 0;
  v_daily_game_points integer := 0;
  v_requested_points integer := 0;
  v_points integer := 0;
  v_is_first_clear boolean := false;
  v_is_milestone boolean := false;
  v_reward_kind text;
  v_reward_roll numeric;
  v_reward_rarity text;
  v_reward_food_id text;
  v_reward_food_name text;
  v_reward_quantity integer := 1;
  v_reward_recorded boolean := false;
  v_companion_id text;
begin
  if v_user_id is null then
    return query select
      false, false, 'UNAUTHORIZED'::text, 0,
      null::text, null::text, 0, 0,
      null::text, null::text, false;
    return;
  end if;

  if p_score < 0
    or p_score > 10000000
    or p_moves_remaining < 0
    or p_moves_remaining > 20
  then
    return query select
      false, false, 'INVALID_GAME_RESULT'::text, 0,
      null::text, null::text, 0, 0,
      null::text, null::text, false;
    return;
  end if;

  select *
  into v_run
  from private.food_sort_runs
  where id = p_run_id
    and user_id = v_user_id
  for update;

  if not found then
    return query select
      false, false, 'RUN_NOT_FOUND'::text, 0,
      null::text, null::text, 0, 0,
      null::text, null::text, false;
    return;
  end if;

  -- A completed run can be acknowledged again, but never writes
  -- inventory, history, score, bond, or progression a second time.
  if v_run.status = 'completed' then
    return query select
      true, v_run.rewarded, 'ALREADY_COMPLETED'::text, 0,
      null::text, null::text, 0, 0,
      null::text, null::text, false;
    return;
  end if;

  if v_run.status <> 'active' then
    return query select
      false, false, 'RUN_NOT_ACTIVE'::text, 0,
      null::text, null::text, 0, 0,
      null::text, null::text, false;
    return;
  end if;

  -- Read this before status changes, because the completion trigger
  -- records the per-level result in the same transaction.
  v_is_first_clear := not exists (
    select 1
    from private.food_sort_level_results
    where user_id = v_user_id
      and level_number = v_run.level_number
      and completed = true
  );

  v_is_milestone :=
    v_is_first_clear
    and v_run.level_number % 5 = 0;

  v_reward_kind := case
    when v_is_milestone then 'milestone_first_clear'
    when v_is_first_clear then 'first_clear'
    else 'replay'
  end;

  update private.food_sort_runs
  set
    status = 'completed',
    score = p_score,
    moves_remaining = p_moves_remaining,
    completed_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = v_run.id;

  select *
  into strict v_context
  from private.user_local_context(
    v_user_id,
    clock_timestamp()
  );

  -- Existing Explorer Score formula and daily cap.
  v_requested_points :=
    floor(p_score / 100.0)::integer * 2;

  select coalesce(sum(xp_delta), 0)
  into v_daily_game_points
  from private.xp_ledger
  where user_id = v_user_id
    and score_category = 'games'
    and cap_group = 'food_sort_daily'
    and (
      created_at at time zone v_context.timezone_name
    )::date = v_context.local_date;

  v_points := greatest(
    0,
    least(
      v_requested_points,
      500 - v_daily_game_points
    )
  );

  if v_points > 0 then
    insert into private.xp_ledger (
      user_id,
      xp_delta,
      source_type,
      event_code,
      score_category,
      cap_group,
      idempotency_key,
      created_at
    )
    values (
      v_user_id,
      v_points,
      'game',
      'food_sort_score',
      'games',
      'food_sort_daily',
      'food-sort-score:' || v_run.id::text,
      clock_timestamp()
    )
    on conflict (idempotency_key)
    do nothing;
  end if;

  select count(*)
  into v_previous_rewards
  from private.food_sort_runs
  where user_id = v_user_id
    and rewarded = true
    and id <> v_run.id
    and completed_at is not null
    and (
      completed_at at time zone v_context.timezone_name
    )::date = v_context.local_date;

  if v_previous_rewards >= 3 then
    return query select
      true, false, 'DAILY_REWARD_CAP'::text, v_points,
      null::text, null::text, 0, v_previous_rewards,
      v_reward_kind, null::text, v_is_first_clear;
    return;
  end if;

  -- Replays deliberately do not produce food on every clear.
  if not v_is_first_clear
    and random() >= 0.35
  then
    return query select
      true, false, 'REPLAY_SCORE_ONLY'::text, v_points,
      null::text, null::text, 0, v_previous_rewards,
      v_reward_kind, null::text, false;
    return;
  end if;

  v_reward_roll := random();

  if v_is_milestone then
    -- 48% common, 36% uncommon, 14% rare, 2% mythic.
    v_reward_rarity := case
      when v_reward_roll < 0.48 then 'common'
      when v_reward_roll < 0.84 then 'uncommon'
      when v_reward_roll < 0.98 then 'rare'
      else 'mythic'
    end;
  elsif v_is_first_clear then
    -- 64% common, 28% uncommon, 7% rare, 1% mythic.
    v_reward_rarity := case
      when v_reward_roll < 0.64 then 'common'
      when v_reward_roll < 0.92 then 'uncommon'
      when v_reward_roll < 0.99 then 'rare'
      else 'mythic'
    end;
  else
    -- Conditional on the 35% replay drop: 80% common,
    -- 18% uncommon, 1.8% rare, 0.2% mythic.
    v_reward_rarity := case
      when v_reward_roll < 0.80 then 'common'
      when v_reward_roll < 0.98 then 'uncommon'
      when v_reward_roll < 0.998 then 'rare'
      else 'mythic'
    end;
  end if;

  -- Select directly from the real companion catalog. drop_weight
  -- controls variety within a rarity without hardcoded fake foods.
  select
    food_id,
    display_name
  into
    v_reward_food_id,
    v_reward_food_name
  from private.companion_food_catalog
  where rarity = v_reward_rarity
    and is_enabled = true
  order by
    -ln(greatest(random(), 0.000001)) /
      drop_weight
  limit 1;

  if v_reward_food_id is null then
    raise exception
      'No enabled % Food Sort reward exists in companion_food_catalog.',
      v_reward_rarity;
  end if;

  v_reward_quantity := case
    when v_is_milestone
      and v_reward_rarity in ('common', 'uncommon')
      then 2
    else 1
  end;

  -- Record the run reward first. The run/food primary key and the
  -- locked run status make the inventory mutation idempotent.
  insert into private.food_sort_reward_items (
    run_id,
    user_id,
    food_id,
    quantity
  )
  values (
    v_run.id,
    v_user_id,
    v_reward_food_id,
    v_reward_quantity
  )
  on conflict do nothing
  returning true
  into v_reward_recorded;

  if not coalesce(v_reward_recorded, false) then
    return query select
      true, true, 'ALREADY_REWARDED'::text, v_points,
      null::text, null::text, 0, v_previous_rewards,
      v_reward_kind, v_reward_rarity, v_is_first_clear;
    return;
  end if;

  insert into public.companion_food_inventory (
    user_id,
    food_id,
    quantity,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_reward_food_id,
    v_reward_quantity,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (user_id, food_id)
  do update set
    quantity =
      public.companion_food_inventory.quantity +
      excluded.quantity,
    updated_at = clock_timestamp();

  perform private.refresh_companion_care(v_user_id);

  select companion_id
  into v_companion_id
  from private.user_companion_progress
  where user_id = v_user_id;

  if v_companion_id is not null then
    update private.user_companion_progress
    set
      bond_points = bond_points + 5,
      happiness = least(100, happiness + 5),
      updated_at = clock_timestamp()
    where user_id = v_user_id;

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

  update private.food_sort_runs
  set
    rewarded = true,
    updated_at = clock_timestamp()
  where id = v_run.id;

  return query select
    true,
    true,
    case
      when v_is_milestone then 'MILESTONE_REWARDED'
      when v_is_first_clear then 'FIRST_CLEAR_REWARDED'
      else 'REPLAY_REWARDED'
    end::text,
    v_points,
    v_reward_food_id,
    v_reward_food_name,
    v_reward_quantity,
    v_previous_rewards + 1,
    v_reward_kind,
    v_reward_rarity,
    v_is_first_clear;
end;
$$;

revoke all
on function public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
from public, anon, authenticated;

grant execute
on function public.server_complete_food_sort_run(
  uuid,
  integer,
  integer
)
to authenticated;

commit;
