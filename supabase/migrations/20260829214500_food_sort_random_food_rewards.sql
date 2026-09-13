begin;

-- ============================================================
-- MISSION TRAILS - RANDOM FOOD SORT REWARDS
-- ============================================================
-- Purpose:
-- Replaces fixed Food Sort food rewards with one
-- server-selected random companion food.
--
-- Reward rarity:
-- Common   = 55%
-- Uncommon = 25%
-- Rare     = 15%
-- Mythic   = 5%
--
-- Food rewards remain limited to the first
-- 3 rewarded Food Sort wins per local day.
-- ============================================================


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
  reward_food_id text,
  reward_food_name text,
  reward_quantity integer,
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

  v_daily_game_points integer := 0;

  v_requested_points integer := 0;

  v_points integer := 0;

  v_reward_roll numeric;

  v_reward_food_id text;

  v_reward_food_name text;

  v_companion_id text;
begin

  -- =========================================================
  -- LOGIN
  -- =========================================================

  if v_user_id is null then
    return query
    select
      false,
      false,
      'UNAUTHORIZED'::text,
      0,
      null::text,
      null::text,
      0,
      0;

    return;
  end if;


  -- =========================================================
  -- GAME VALUE CHECK
  -- =========================================================

  if p_score < 0
    or p_score > 10000000
    or p_moves_remaining < 0
    or p_moves_remaining > 20
  then
    return query
    select
      false,
      false,
      'INVALID_GAME_RESULT'::text,
      0,
      null::text,
      null::text,
      0,
      0;

    return;
  end if;


  -- =========================================================
  -- LOAD RUN
  -- =========================================================

  select *
  into v_run
  from private.food_sort_runs
  where id = p_run_id
    and user_id = v_user_id
  for update;


  if not found then
    return query
    select
      false,
      false,
      'RUN_NOT_FOUND'::text,
      0,
      null::text,
      null::text,
      0,
      0;

    return;
  end if;


  if v_run.status = 'completed' then
    return query
    select
      true,
      v_run.rewarded,
      'ALREADY_COMPLETED'::text,
      0,
      null::text,
      null::text,
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
      null::text,
      null::text,
      0,
      0;

    return;
  end if;


  -- =========================================================
  -- COMPLETE RUN
  -- =========================================================
  --
  -- Purpose:
  -- Completing the run first allows the existing
  -- level progression trigger to advance the player.
  -- =========================================================

  update private.food_sort_runs
  set
    status = 'completed',

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


  -- =========================================================
  -- EXPLORER SCORE
  -- =========================================================
  --
  -- Every complete 100 Food Sort points = 2 Explorer Score.
  --
  -- Example:
  -- 1260 game score = 24 Explorer Score.
  --
  -- Food Sort Explorer Score remains capped at
  -- 500 points per local day.
  -- =========================================================

  v_requested_points :=
    floor(
      p_score / 100.0
    )::integer * 2;


  select
    coalesce(
      sum(xp_delta),
      0
    )
  into v_daily_game_points
  from private.xp_ledger
  where user_id =
      v_user_id

    and score_category =
      'games'

    and cap_group =
      'food_sort_daily'

    and created_at >=
      date_trunc(
        'day',
        clock_timestamp()
      );


  v_points :=
    greatest(
      0,

      least(
        v_requested_points,
        500 -
          v_daily_game_points
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
      'food-sort-score:' ||
        v_run.id::text,
      clock_timestamp()
    )
    on conflict (
      idempotency_key
    )
    do nothing;

  end if;


  -- =========================================================
  -- USER LOCAL DAY
  -- =========================================================

  select *
  into strict v_context
  from private.user_local_context(
    v_user_id,
    clock_timestamp()
  );


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


  -- =========================================================
  -- MAX 3 FOOD REWARD WINS PER DAY
  -- =========================================================

  if v_previous_rewards >= 3 then

    return query
    select
      true,
      false,
      'SCORE_ONLY'::text,
      v_points,
      null::text,
      null::text,
      0,
      v_previous_rewards;

    return;
  end if;


  -- =========================================================
  -- RANDOM FOOD RARITY
  -- =========================================================

  v_reward_roll :=
    random();


  -- ---------------------------------------------------------
  -- COMMON 55%
  -- ---------------------------------------------------------

  if v_reward_roll < 0.55 then

    select *
    into
      v_reward_food_id,
      v_reward_food_name
    from (
      values
        ('aurora-pudding', 'Aurora Pudding'),
        ('comet-cupcake', 'Comet Cupcake'),
        ('galaxy-donut', 'Galaxy Donut'),
        ('novah-waffle', 'Novah Waffle'),
        ('pixel-macaron', 'Pixel Macaron'),
        ('star-biscuit', 'Star Biscuit'),
        ('ember-carrot', 'Ember Carrot'),
        ('neon-apple', 'Neon Apple'),
        ('solar-mango', 'Solar Mango')
    ) as rewards(
      food_id,
      food_name
    )
    order by random()
    limit 1;


  -- ---------------------------------------------------------
  -- UNCOMMON 25%
  -- ---------------------------------------------------------

  elsif v_reward_roll < 0.80 then

    select *
    into
      v_reward_food_id,
      v_reward_food_name
    from (
      values
        ('cosmic-berry', 'Cosmic Berry'),
        ('icy-frost-melon', 'Icy Frost Melon'),
        ('plasma-grapes', 'Plasma Grapes'),
        ('rainbow-starfruit', 'Rainbow Starfruit'),
        ('dream-tea', 'Dream Tea'),
        ('electro-water-bottle', 'Electro Water Bottle'),
        ('moon-milk', 'Moon Milk'),
        ('stamina-smooth', 'Stamina Smooth'),
        ('sunbeam-soup', 'Sunbeam Soup')
    ) as rewards(
      food_id,
      food_name
    )
    order by random()
    limit 1;


  -- ---------------------------------------------------------
  -- RARE 15%
  -- ---------------------------------------------------------

  elsif v_reward_roll < 0.95 then

    select *
    into
      v_reward_food_id,
      v_reward_food_name
    from (
      values
        ('energy-steak', 'Energy Steak'),
        ('meteor-burger', 'Meteor Burger'),
        ('power-bowl', 'Power Bowl'),
        ('salmon', 'Salmon'),
        ('turbo-drumstick', 'Turbo Drumstick')
    ) as rewards(
      food_id,
      food_name
    )
    order by random()
    limit 1;


  -- ---------------------------------------------------------
  -- MYTHIC 5%
  -- ---------------------------------------------------------

  else

    select *
    into
      v_reward_food_id,
      v_reward_food_name
    from (
      values
        ('crystal-rock', 'Crystal Rock'),
        ('cyber-lollipop', 'Cyber Lollipop'),
        ('infinity-candy', 'Infinity Candy'),
        ('jelly-beans', 'Jelly Beans'),
        ('quantum-gummy', 'Quantum Gummy'),
        ('stardust-taffy', 'Stardust Taffy'),
        ('time-crystal-cake', 'Time Crystal Cake')
    ) as rewards(
      food_id,
      food_name
    )
    order by random()
    limit 1;

  end if;


  -- =========================================================
  -- VERIFY FOOD EXISTS IN CATALOG
  -- =========================================================

  if not exists (
    select 1
    from private.companion_food_catalog
    where food_id =
      v_reward_food_id
  ) then

    raise exception
      'Food Sort reward food % is missing from companion_food_catalog.',
      v_reward_food_id;

  end if;


  -- =========================================================
  -- ADD FOOD TO PLAYER INVENTORY
  -- =========================================================

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


  -- Save exact reward history.
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
    1
  )
  on conflict do nothing;


  -- =========================================================
  -- COMPANION PLAY REWARD
  -- =========================================================

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


  if v_companion_id
    is not null
  then

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


  -- =========================================================
  -- MARK RUN REWARDED
  -- =========================================================

  update private.food_sort_runs
  set
    rewarded =
      true,

    updated_at =
      clock_timestamp()

  where id =
    v_run.id;


  -- =========================================================
  -- RESPONSE
  -- =========================================================

  return query
  select
    true,
    true,
    'REWARDED'::text,

    v_points,

    v_reward_food_id,
    v_reward_food_name,

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
