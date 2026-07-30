begin;

create table if not exists private.device_daily_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  step_count integer not null default 0 check (step_count between 0 and 100000),
  last_reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table if not exists private.device_step_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  local_date date not null,
  reported_steps integer not null check (reported_steps between 0 and 100000),
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create or replace function public.server_record_device_steps(
  p_user_id uuid,
  p_local_date date,
  p_steps integer,
  p_idempotency_key text
)
returns table (accepted boolean, step_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_progress_id uuid;
  v_inserted integer;
  v_steps integer;
begin
  if p_steps < 0 or p_steps > 100000 or length(p_idempotency_key) < 16 then
    return query select false, 0;
    return;
  end if;

  select * into strict v_context
  from private.user_local_context(p_user_id, clock_timestamp());
  if p_local_date <> v_context.local_date then
    return query select false, 0;
    return;
  end if;

  insert into private.device_step_reports (
    user_id, idempotency_key, local_date, reported_steps
  ) values (
    p_user_id, p_idempotency_key, p_local_date, p_steps
  ) on conflict (user_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;

  insert into private.device_daily_steps (user_id, local_date, step_count)
  values (p_user_id, p_local_date, p_steps)
  on conflict (user_id, local_date) do update
    set step_count = greatest(private.device_daily_steps.step_count, excluded.step_count),
        last_reported_at = clock_timestamp(),
        updated_at = clock_timestamp()
  returning private.device_daily_steps.step_count into v_steps;

  v_progress_id := private.ensure_daily_progress(p_user_id, clock_timestamp());
  update private.daily_mission_completion as completion
  set progress_value = least(completion.target_value, v_steps),
      status = case
        when completion.status in ('locked', 'claimed') then completion.status
        when v_steps >= completion.target_value then 'completed'
        else 'active'
      end,
      completed_at = case
        when completion.status = 'claimed' then completion.completed_at
        when v_steps >= completion.target_value
          then coalesce(completion.completed_at, clock_timestamp())
        else null
      end,
      updated_at = clock_timestamp()
  from private.daily_mission_definitions as definition
  where completion.daily_progress_id = v_progress_id
    and definition.mission_id = completion.mission_id
    and definition.metric = 'verified_steps';

  perform private.recompute_daily_progress(v_progress_id);
  return query select v_inserted = 1, v_steps;
end;
$$;

create or replace function public.server_get_device_steps(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select steps.step_count
    from private.device_daily_steps as steps
    join lateral private.user_local_context(p_user_id, clock_timestamp()) as context on true
    where steps.user_id = p_user_id and steps.local_date = context.local_date
  ), 0)::integer;
$$;

create table if not exists private.companion_reward_config (
  singleton boolean primary key default true check (singleton),
  bond_points_per_mission integer not null default 2 check (bond_points_per_mission >= 0),
  bond_points_all_daily integer not null default 10 check (bond_points_all_daily >= 0),
  energy_restore_per_mission integer not null default 5 check (energy_restore_per_mission >= 0),
  maximum_energy integer not null default 100 check (maximum_energy > 0),
  bond_points_per_tier integer not null default 100 check (bond_points_per_tier > 0),
  updated_at timestamptz not null default now()
);

insert into private.companion_reward_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists private.user_companion_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  companion_id text,
  bond_points integer not null default 0 check (bond_points >= 0),
  energy integer not null default 100 check (energy >= 0),
  updated_at timestamptz not null default now()
);

create or replace function private.reward_companion_from_xp_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.companion_reward_config%rowtype;
  v_metric text;
  v_bond_reward integer;
begin
  if new.source_type <> 'mission' then return new; end if;

  select * into strict v_config
  from private.companion_reward_config
  where singleton;

  select definition.metric into v_metric
  from private.daily_mission_completion as completion
  join private.daily_mission_definitions as definition
    on definition.mission_id = completion.mission_id
  where completion.id = new.source_id;

  v_bond_reward := case
    when v_metric = 'verified_daily_set' then v_config.bond_points_all_daily
    else v_config.bond_points_per_mission
  end;

  insert into private.user_companion_progress (
    user_id, companion_id, bond_points, energy
  ) values (
    new.user_id, 'novah', v_bond_reward, v_config.maximum_energy
  )
  on conflict (user_id) do update
    set bond_points = private.user_companion_progress.bond_points + v_bond_reward,
        energy = least(
          v_config.maximum_energy,
          private.user_companion_progress.energy + v_config.energy_restore_per_mission
        ),
        updated_at = clock_timestamp();

  return new;
end;
$$;

drop trigger if exists reward_companion_after_mission_xp on private.xp_ledger;
create trigger reward_companion_after_mission_xp
after insert on private.xp_ledger
for each row execute function private.reward_companion_from_xp_ledger();

-- Preserve rewards for mission XP that existed before this trigger was added.
insert into private.user_companion_progress (user_id, companion_id, bond_points, energy)
select
  ledger.user_id,
  'novah',
  sum(case
    when definition.metric = 'verified_daily_set' then config.bond_points_all_daily
    else config.bond_points_per_mission
  end)::integer,
  config.maximum_energy
from private.xp_ledger as ledger
cross join private.companion_reward_config as config
left join private.daily_mission_completion as completion on completion.id = ledger.source_id
left join private.daily_mission_definitions as definition
  on definition.mission_id = completion.mission_id
where ledger.source_type = 'mission' and config.singleton
group by ledger.user_id, config.maximum_energy
on conflict (user_id) do update
  set bond_points = greatest(
        private.user_companion_progress.bond_points,
        excluded.bond_points
      ),
      updated_at = clock_timestamp();

create or replace function public.server_get_companion_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress private.user_companion_progress%rowtype;
  v_config private.companion_reward_config%rowtype;
begin
  select * into strict v_config from private.companion_reward_config where singleton;

  insert into private.user_companion_progress (user_id, companion_id, energy)
  values (p_user_id, 'novah', v_config.maximum_energy)
  on conflict (user_id) do nothing;

  select * into strict v_progress
  from private.user_companion_progress
  where user_id = p_user_id;

  return jsonb_build_object(
    'companionId', v_progress.companion_id,
    'bondPoints', v_progress.bond_points,
    'bondTier', floor(v_progress.bond_points::numeric / v_config.bond_points_per_tier) + 1,
    'bondPercent', least(100, floor(
      mod(v_progress.bond_points, v_config.bond_points_per_tier)::numeric
      * 100 / v_config.bond_points_per_tier
    )),
    'energy', least(v_config.maximum_energy, v_progress.energy),
    'maximumEnergy', v_config.maximum_energy
  );
end;
$$;

revoke all on function public.server_record_device_steps(uuid, date, integer, text)
  from public, anon, authenticated;
revoke all on function public.server_get_device_steps(uuid) from public, anon, authenticated;
revoke all on function public.server_get_companion_progress(uuid) from public, anon, authenticated;
grant execute on function public.server_record_device_steps(uuid, date, integer, text) to service_role;
grant execute on function public.server_get_device_steps(uuid) to service_role;
grant execute on function public.server_get_companion_progress(uuid) to service_role;

commit;
