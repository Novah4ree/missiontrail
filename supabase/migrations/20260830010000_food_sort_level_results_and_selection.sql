begin;

-- ============================================================
-- FOOD SORT LEVEL RESULTS + LOCKED LEVEL SELECTION
-- ============================================================
-- Extends the existing server-owned Food Sort progression.
-- highest_level now means the highest UNLOCKED level.
-- ============================================================

-- Repair rows created when highest_level meant highest completed.
update private.food_sort_progress
set
  highest_level = greatest(
    highest_level,
    current_level
  ),
  updated_at = clock_timestamp();


-- Optional per-level history keeps completion and best score
-- without introducing a client-side progress store.
create table if not exists private.food_sort_level_results (
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  level_number integer not null
    check (level_number >= 1),

  completed boolean not null
    default true,

  best_score integer not null
    default 0
    check (best_score >= 0),

  first_completed_at timestamptz not null
    default now(),

  last_completed_at timestamptz not null
    default now(),

  primary key (
    user_id,
    level_number
  )
);


insert into private.food_sort_level_results (
  user_id,
  level_number,
  completed,
  best_score,
  first_completed_at,
  last_completed_at
)
select
  runs.user_id,
  runs.level_number,
  true,
  max(runs.score)::integer,
  min(runs.completed_at),
  max(runs.completed_at)
from private.food_sort_runs as runs
where runs.status = 'completed'
  and runs.completed_at is not null
group by
  runs.user_id,
  runs.level_number
on conflict (
  user_id,
  level_number
)
do update set
  completed = true,
  best_score = greatest(
    private.food_sort_level_results.best_score,
    excluded.best_score
  ),
  first_completed_at = least(
    private.food_sort_level_results.first_completed_at,
    excluded.first_completed_at
  ),
  last_completed_at = greatest(
    private.food_sort_level_results.last_completed_at,
    excluded.last_completed_at
  );


-- One transition to completed records the result and unlocks
-- exactly the following level. Replays never skip the frontier.
create or replace function private.advance_food_sort_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'completed'
    and new.status = 'completed'
  then
    insert into private.food_sort_level_results (
      user_id,
      level_number,
      completed,
      best_score,
      first_completed_at,
      last_completed_at
    )
    values (
      new.user_id,
      new.level_number,
      true,
      new.score,
      coalesce(new.completed_at, clock_timestamp()),
      coalesce(new.completed_at, clock_timestamp())
    )
    on conflict (
      user_id,
      level_number
    )
    do update set
      completed = true,
      best_score = greatest(
        private.food_sort_level_results.best_score,
        excluded.best_score
      ),
      last_completed_at = excluded.last_completed_at;

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
      new.level_number + 1,
      1,
      new.score,
      clock_timestamp()
    )
    on conflict (user_id)
    do update set
      current_level = greatest(
        private.food_sort_progress.current_level,
        new.level_number + 1
      ),
      highest_level = greatest(
        private.food_sort_progress.highest_level,
        new.level_number + 1
      ),
      total_wins =
        private.food_sort_progress.total_wins + 1,
      highest_score = greatest(
        private.food_sort_progress.highest_score,
        new.score
      ),
      updated_at = clock_timestamp();
  end if;

  return new;
end;
$$;


-- The phone may request a replay, but the server rejects every
-- request above the persisted unlock frontier.
create or replace function public.server_start_food_sort_run_v3(
  p_level integer
)
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
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_highest_unlocked integer;
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

  insert into private.food_sort_progress (
    user_id
  )
  values (
    v_user_id
  )
  on conflict (user_id)
  do nothing;

  select greatest(
    current_level,
    highest_level
  )
  into strict v_highest_unlocked
  from private.food_sort_progress
  where user_id = v_user_id;

  if p_level is null
    or p_level < 1
    or p_level > v_highest_unlocked
  then
    return query
    select
      null::uuid,
      coalesce(p_level, 1),
      false,
      'LEVEL_LOCKED'::text;
    return;
  end if;

  update private.food_sort_runs
  set
    status = 'abandoned',
    updated_at = clock_timestamp()
  where user_id = v_user_id
    and status = 'active';

  insert into private.food_sort_runs (
    user_id,
    level_id,
    level_number,
    status
  )
  values (
    v_user_id,
    concat('level-', p_level),
    p_level,
    'active'
  )
  returning id
  into v_run_id;

  return query
  select
    v_run_id,
    p_level,
    true,
    'STARTED'::text;
end;
$$;


revoke all
on function public.server_start_food_sort_run_v3(integer)
from public, anon, authenticated;

grant execute
on function public.server_start_food_sort_run_v3(integer)
to authenticated;

commit;
