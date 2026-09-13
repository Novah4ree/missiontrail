begin;

-- =========================================================
-- FOOD SORT LEVEL PROGRESSION V2
-- =========================================================
--
-- Purpose:
-- Makes Food Sort level progression authoritative.
--
-- Win Level 1 -> Level 2
-- Win Level 2 -> Level 3
-- Win Level 3 -> Level 4
-- etc.
--
-- The server now tells the phone exactly which level
-- it started instead of making the phone guess.
-- =========================================================


-- =========================================================
-- 1. REPAIR SAVED PROGRESSION FROM COMPLETED RUNS
-- =========================================================

insert into private.food_sort_progress (
  user_id,
  current_level,
  highest_level,
  total_wins,
  highest_score,
  updated_at
)
select
  runs.user_id,

  count(*)::integer + 1,

  greatest(
    1,
    count(*)::integer
  ),

  count(*)::integer,

  coalesce(
    max(runs.score),
    0
  )::integer,

  clock_timestamp()

from private.food_sort_runs
  as runs

where runs.status =
  'completed'

group by
  runs.user_id

on conflict (
  user_id
)
do update set

  current_level =
    greatest(
      private.food_sort_progress.current_level,
      excluded.current_level
    ),

  highest_level =
    greatest(
      private.food_sort_progress.highest_level,
      excluded.highest_level
    ),

  total_wins =
    greatest(
      private.food_sort_progress.total_wins,
      excluded.total_wins
    ),

  highest_score =
    greatest(
      private.food_sort_progress.highest_score,
      excluded.highest_score
    ),

  updated_at =
    clock_timestamp();


-- =========================================================
-- 2. MAKE LEVEL ADVANCEMENT RELIABLE
-- =========================================================

create or replace function
private.advance_food_sort_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if
    old.status <> 'completed'
    and
    new.status = 'completed'
  then

    insert into private.food_sort_progress (
      user_id,
      current_level,
      highest_level,
      total_wins,
      highest_score,
      updated_at
    )
    values (
      new.user_id,

      new.level_number + 1,

      new.level_number,

      1,

      new.score,

      clock_timestamp()
    )

    on conflict (
      user_id
    )

    do update set

      current_level =
        greatest(
          private.food_sort_progress.current_level,
          new.level_number + 1
        ),

      highest_level =
        greatest(
          private.food_sort_progress.highest_level,
          new.level_number
        ),

      total_wins =
        private.food_sort_progress.total_wins
        + 1,

      highest_score =
        greatest(
          private.food_sort_progress.highest_score,
          new.score
        ),

      updated_at =
        clock_timestamp();

  end if;


  return new;

end;
$$;


drop trigger if exists
food_sort_advance_progress
on private.food_sort_runs;


create trigger
food_sort_advance_progress

after update of status
on private.food_sort_runs

for each row

execute function
private.advance_food_sort_progress();


-- =========================================================
-- 3. START FOOD SORT V2
-- =========================================================
--
-- IMPORTANT:
-- This RPC returns the REAL server level with the run.
-- The app no longer has to depend on two separate calls.
-- =========================================================

create or replace function
public.server_start_food_sort_run_v2()
returns table (
  run_id uuid,
  level_number integer,
  started boolean,
  result_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_run_id uuid;

  v_level integer;
begin

  if v_user_id is null then

    return query
    select
      null::uuid,
      1,
      false,
      'UNAUTHORIZED'::text;

    return;

  end if;


  -- Make sure progression exists.
  insert into private.food_sort_progress (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (
    user_id
  )
  do nothing;


  -- Get the player's REAL next level.
  select
    current_level
  into strict
    v_level
  from private.food_sort_progress
  where user_id =
    v_user_id;


  -- Close an unfinished old run.
  update private.food_sort_runs
  set
    status =
      'abandoned',

    updated_at =
      clock_timestamp()

  where user_id =
    v_user_id

    and status =
      'active';


  -- Start the exact level stored on the server.
  insert into private.food_sort_runs (
    user_id,
    level_id,
    level_number,
    status
  )
  values (
    v_user_id,

    concat(
      'level-',
      v_level
    ),

    v_level,

    'active'
  )

  returning id
  into v_run_id;


  return query
  select
    v_run_id,
    v_level,
    true,
    'STARTED'::text;

end;
$$;


revoke all
on function
public.server_start_food_sort_run_v2()
from public, anon, authenticated;


grant execute
on function
public.server_start_food_sort_run_v2()
to authenticated;


commit;
