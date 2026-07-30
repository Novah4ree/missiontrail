begin;

-- Each mission definition owns its complete reward bundle. UI components only
-- display these values and cannot choose permanent rewards.
alter table private.daily_mission_definitions
  add column if not exists reward_bond_xp integer not null default 2
    check (reward_bond_xp >= 0),
  add column if not exists reward_energy_restore integer not null default 5
    check (reward_energy_restore >= 0),
  add column if not exists reward_companion_xp integer not null default 0
    check (reward_companion_xp >= 0);

-- Editable defaults: regular +2 Bond, walking +3 Bond, daily set +10 Bond.
-- A future companion-specific mission can set reward_bond_xp = 5 directly.
update private.daily_mission_definitions
set reward_bond_xp = case
      when metric = 'verified_daily_set' then 10
      when metric in (
        'verified_distance_meters', 'verified_steps',
        'verified_active_seconds', 'verified_session_count'
      ) then 3
      else 2
    end
where reward_bond_xp = 2;

create table if not exists private.player_level_milestones (
  level integer primary key check (level >= 2),
  reward_code text not null unique,
  reward_payload jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true
);

alter table private.xp_ledger
  add column if not exists idempotency_key text;

update private.xp_ledger as ledger
set idempotency_key = concat(
  ledger.user_id, ':', completion.mission_id, ':', completion.id
)
from private.daily_mission_completion as completion
where ledger.source_type = 'mission'
  and ledger.source_id = completion.id
  and ledger.idempotency_key is null;

create unique index if not exists xp_ledger_mission_idempotency_idx
  on private.xp_ledger (user_id, idempotency_key)
  where idempotency_key is not null;

-- This is the database copy of src/config/progression-rules.ts. Claims return
-- the resulting levels, while every app screen uses the shared TypeScript
-- engine to render the lifetime XP returned by the ledger.
create or replace function private.xp_required_for_level(p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(100 * power(greatest(1, p_level)::numeric, 1.35))::integer;
$$;

create or replace function private.player_level_from_xp(p_total_xp bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
  v_remaining bigint := greatest(0, p_total_xp);
  v_required integer;
begin
  loop
    v_required := private.xp_required_for_level(v_level);
    exit when v_remaining < v_required;
    v_remaining := v_remaining - v_required;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- Mission companion rewards happen only for a persisted active companion.
-- Merely reading progress never invents a companion or grants default stats.
create or replace function private.reward_companion_from_xp_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bond_reward integer;
  v_energy_restore integer;
begin
  if new.source_type <> 'mission' then return new; end if;

  select
    definition.reward_bond_xp,
    definition.reward_energy_restore
  into v_bond_reward, v_energy_restore
  from private.daily_mission_completion as completion
  join private.daily_mission_definitions as definition
    on definition.mission_id = completion.mission_id
  where completion.id = new.source_id;

  if not found then return new; end if;

  update private.user_companion_progress as companion
  set bond_points = companion.bond_points + v_bond_reward,
      energy = least(
        config.maximum_energy,
        greatest(0, companion.energy + v_energy_restore)
      ),
      updated_at = clock_timestamp()
  from private.companion_reward_config as config
  where companion.user_id = new.user_id
    and companion.companion_id is not null
    and config.singleton;

  return new;
end;
$$;

-- Reward amounts now live only on mission definitions. This removes the older
-- duplicate defaults that could disagree with an individual mission bundle.
alter table private.companion_reward_config
  drop column if exists bond_points_per_mission,
  drop column if exists bond_points_all_daily,
  drop column if exists energy_restore_per_mission;

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
  select * into strict v_config
  from private.companion_reward_config
  where singleton;

  select * into v_progress
  from private.user_companion_progress
  where user_id = p_user_id;

  if not found or v_progress.companion_id is null then
    return jsonb_build_object(
      'companionId', null,
      'bondPoints', 0,
      'bondTier', 1,
      'bondPercent', 0,
      'energy', 0,
      'maximumEnergy', v_config.maximum_energy
    );
  end if;

  return jsonb_build_object(
    'companionId', v_progress.companion_id,
    'bondPoints', greatest(0, v_progress.bond_points),
    'bondTier', floor(
      greatest(0, v_progress.bond_points)::numeric
      / v_config.bond_points_per_tier
    ) + 1,
    'bondPercent', least(100, greatest(0, floor(
      mod(greatest(0, v_progress.bond_points), v_config.bond_points_per_tier)::numeric
      * 100 / v_config.bond_points_per_tier
    ))),
    'energy', least(v_config.maximum_energy, greatest(0, v_progress.energy)),
    'maximumEnergy', v_config.maximum_energy
  );
end;
$$;

create or replace function public.server_get_mission_rewards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress_id uuid := private.ensure_daily_progress(p_user_id, clock_timestamp());
begin
  return coalesce((
    select jsonb_object_agg(
      definition.mission_id,
      jsonb_build_object(
        'xp', definition.reward_xp,
        'bondXp', definition.reward_bond_xp,
        'energyRestore', definition.reward_energy_restore,
        'companionXp', definition.reward_companion_xp
      )
    )
    from private.daily_mission_completion as completion
    join private.daily_mission_definitions as definition
      on definition.mission_id = completion.mission_id
    where completion.daily_progress_id = v_progress_id
      and definition.is_enabled
  ), '{}'::jsonb);
end;
$$;

create or replace function public.server_get_daily_streak(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_latest date;
  v_expected date;
  v_day date;
  v_streak integer := 0;
begin
  select local_date into strict v_today
  from private.user_local_context(p_user_id, clock_timestamp());

  select max(progress.local_date) into v_latest
  from private.user_daily_progress as progress
  where progress.user_id = p_user_id
    and exists (
      select 1
      from private.daily_mission_completion as completion
      where completion.daily_progress_id = progress.id
        and completion.status in ('completed', 'claimed')
    );

  if v_latest is null or v_latest < v_today - 1 then return 0; end if;
  v_expected := v_latest;

  for v_day in
    select distinct progress.local_date
    from private.user_daily_progress as progress
    where progress.user_id = p_user_id
      and exists (
        select 1
        from private.daily_mission_completion as completion
        where completion.daily_progress_id = progress.id
          and completion.status in ('completed', 'claimed')
      )
    order by progress.local_date desc
  loop
    if v_day = v_expected then
      v_streak := v_streak + 1;
      v_expected := v_expected - 1;
    elsif v_day < v_expected then
      exit;
    end if;
  end loop;

  return v_streak;
end;
$$;

drop function if exists public.server_claim_mission_reward(uuid, text);
create function public.server_claim_mission_reward(
  p_user_id uuid,
  p_mission_id text
)
returns table (
  claimed boolean,
  result_code text,
  xp_awarded integer,
  old_total_xp bigint,
  new_total_xp bigint,
  old_level integer,
  new_level integer,
  levels_gained integer,
  milestone_rewards_crossed jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress_id uuid;
  v_completion private.daily_mission_completion%rowtype;
  v_reward integer;
  v_inserted integer;
  v_updated integer;
  v_old_total bigint;
  v_new_total bigint;
  v_old_level integer;
  v_new_level integer;
  v_milestones jsonb;
begin
  -- Serialize mission claims for one user so old/new XP values are meaningful.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_progress_id := private.ensure_daily_progress(p_user_id, clock_timestamp());
  perform private.recompute_daily_progress(v_progress_id);

  select completion.* into v_completion
  from private.daily_mission_completion as completion
  where completion.daily_progress_id = v_progress_id
    and completion.mission_id = p_mission_id
  for update of completion;

  if not found then
    return query select false, 'MISSION_NOT_FOUND', 0, 0::bigint, 0::bigint,
      1, 1, 0, '[]'::jsonb;
    return;
  end if;

  select coalesce(sum(ledger.xp_delta), 0)::bigint into v_old_total
  from private.xp_ledger as ledger
  where ledger.user_id = p_user_id;
  v_old_level := private.player_level_from_xp(v_old_total);

  if v_completion.status = 'claimed' then
    return query select false, 'ALREADY_CLAIMED', 0, v_old_total, v_old_total,
      v_old_level, v_old_level, 0, '[]'::jsonb;
    return;
  end if;
  if v_completion.status <> 'completed' then
    return query select false, 'REQUIREMENT_NOT_MET', 0, v_old_total, v_old_total,
      v_old_level, v_old_level, 0, '[]'::jsonb;
    return;
  end if;

  select definition.reward_xp into strict v_reward
  from private.daily_mission_definitions as definition
  where definition.mission_id = v_completion.mission_id;

  insert into private.xp_ledger (
    user_id, source_type, source_id, xp_delta, idempotency_key
  )
  values (
    p_user_id,
    'mission',
    v_completion.id,
    v_reward,
    concat(p_user_id, ':', v_completion.mission_id, ':', v_completion.id)
  )
  on conflict (user_id, source_type, source_id) do nothing;
  get diagnostics v_inserted = row_count;

  update private.daily_mission_completion
  set status = 'claimed',
      claimed_at = clock_timestamp(),
      xp_awarded = v_reward,
      updated_at = clock_timestamp()
  where id = v_completion.id and status = 'completed';
  get diagnostics v_updated = row_count;

  select coalesce(sum(ledger.xp_delta), 0)::bigint into v_new_total
  from private.xp_ledger as ledger
  where ledger.user_id = p_user_id;
  v_new_level := private.player_level_from_xp(v_new_total);

  select coalesce(jsonb_agg(jsonb_build_object(
    'level', milestone.level,
    'rewardCode', milestone.reward_code,
    'reward', milestone.reward_payload
  ) order by milestone.level), '[]'::jsonb)
  into v_milestones
  from private.player_level_milestones as milestone
  where milestone.is_enabled
    and milestone.level > v_old_level
    and milestone.level <= v_new_level;

  return query select
    v_updated = 1,
    case when v_updated = 1 then 'CLAIMED' else 'ALREADY_CLAIMED' end,
    case when v_inserted = 1 then v_reward else 0 end,
    v_old_total,
    v_new_total,
    v_old_level,
    v_new_level,
    greatest(0, v_new_level - v_old_level),
    v_milestones;
end;
$$;

revoke all on function public.server_get_companion_progress(uuid)
  from public, anon, authenticated;
revoke all on function public.server_get_mission_rewards(uuid)
  from public, anon, authenticated;
revoke all on function public.server_get_daily_streak(uuid)
  from public, anon, authenticated;
revoke all on function public.server_claim_mission_reward(uuid, text)
  from public, anon, authenticated;
grant execute on function public.server_get_companion_progress(uuid) to service_role;
grant execute on function public.server_get_mission_rewards(uuid) to service_role;
grant execute on function public.server_get_daily_streak(uuid) to service_role;
grant execute on function public.server_claim_mission_reward(uuid, text) to service_role;

commit;
