begin;

-- When the player's first real hatch becomes the active companion, carry the
-- relic XP/HP bank into that newborn companion and then clear the egg bank.
create or replace function public.server_register_hatched_companion(
  p_instance_id text,
  p_companion_id text,
  p_egg_id text,
  p_hatched_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config private.companion_reward_config%rowtype;
  v_active_companion_id text;
  v_previous_active_companion_id text;
  v_hatch_xp bigint := 0;
  v_hatch_hp bigint := 0;
  v_new_level integer := 1;
  v_life_stage text := 'baby';
begin
  if v_user_id is null then
    raise exception using
      message = 'UNAUTHORIZED',
      errcode = '42501';
  end if;

  if p_instance_id is null
     or btrim(p_instance_id) = ''
     or p_companion_id is null
     or btrim(p_companion_id) = ''
     or p_egg_id is null
     or btrim(p_egg_id) = ''
  then
    raise exception using
      message = 'INVALID_COMPANION_HATCH',
      errcode = '22023';
  end if;

  insert into private.user_hatched_companions (
    user_id,
    instance_id,
    companion_id,
    egg_id,
    hatched_at
  )
  values (
    v_user_id,
    p_instance_id,
    p_companion_id,
    p_egg_id,
    coalesce(p_hatched_at, clock_timestamp())
  )
  on conflict (user_id, instance_id)
  do nothing;

  select *
  into strict v_config
  from private.companion_reward_config
  where singleton;

  select progress.companion_id
  into v_previous_active_companion_id
  from private.user_companion_progress as progress
  where progress.user_id = v_user_id
  for update;

  if not found then
    v_previous_active_companion_id := null;
  end if;

  insert into private.user_companion_progress (
    user_id,
    companion_id,
    energy
  )
  values (
    v_user_id,
    p_companion_id,
    v_config.maximum_energy
  )
  on conflict (user_id)
  do update
  set
    companion_id = coalesce(
      private.user_companion_progress.companion_id,
      excluded.companion_id
    ),
    updated_at = clock_timestamp();

  select progress.companion_id
  into v_active_companion_id
  from private.user_companion_progress as progress
  where progress.user_id = v_user_id;

  -- Only the hatch that actually establishes the first active companion gets
  -- the egg bank. Later hatches do not steal progression from the active one.
  if v_previous_active_companion_id is null
     and v_active_companion_id = p_companion_id
  then
    insert into private.user_egg_growth_bank (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    select bank.hatch_xp, bank.hatch_hp
    into v_hatch_xp, v_hatch_hp
    from private.user_egg_growth_bank as bank
    where bank.user_id = v_user_id
    for update;

    update private.user_companion_progress
    set
      companion_xp = companion_xp + greatest(0, v_hatch_xp),
      growth_hp = growth_hp + greatest(0, v_hatch_hp),
      updated_at = clock_timestamp()
    where user_id = v_user_id;

    select private.companion_level_from_growth(
      progress.companion_xp,
      progress.growth_hp
    )
    into v_new_level
    from private.user_companion_progress as progress
    where progress.user_id = v_user_id;

    update private.user_companion_progress
    set
      companion_level = v_new_level,
      updated_at = clock_timestamp()
    where user_id = v_user_id;

    v_life_stage := private.companion_life_stage_from_level(v_new_level);

    update private.user_egg_growth_bank
    set
      hatch_xp = 0,
      hatch_hp = 0,
      updated_at = clock_timestamp()
    where user_id = v_user_id;
  else
    select
      coalesce(progress.companion_level, 1),
      private.companion_life_stage_from_level(
        coalesce(progress.companion_level, 1)
      )
    into v_new_level, v_life_stage
    from private.user_companion_progress as progress
    where progress.user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'registered', true,
    'instanceId', p_instance_id,
    'companionId', p_companion_id,
    'activeCompanionId', v_active_companion_id,
    'eggXpTransferred', greatest(0, v_hatch_xp),
    'eggHpTransferred', greatest(0, v_hatch_hp),
    'companionLevel', v_new_level,
    'lifeStage', v_life_stage
  );
end;
$$;

revoke all
on function public.server_register_hatched_companion(
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.server_register_hatched_companion(
  text,
  text,
  text,
  timestamptz
)
to authenticated;

commit;
