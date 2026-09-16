begin;

-- =========================================================
-- MISSION TRAILS: UNIFIED COMPANION XP + HP GROWTH
-- =========================================================
-- Goals:
--   1. Relics award BOTH companion XP and Growth HP.
--   2. Before the first companion is active, relic rewards are banked
--      as Egg Hatch XP / HP so those discoveries still help hatch.
--   3. Food earned from missions/games awards BOTH companion XP and HP
--      when the player actually feeds it to a companion.
--   4. Companion level is based on combined XP + HP growth points.
--   5. Life stage is automatic: Baby -> Teen -> Adult.
--
-- Existing user XP remains separate. We do not take anything away from
-- the player's Explorer XP system.
-- =========================================================


-- =========================================================
-- 1. COMPANION XP
-- =========================================================

alter table private.user_companion_progress
  add column if not exists companion_xp bigint not null default 0
    check (companion_xp >= 0);

comment on column private.user_companion_progress.companion_xp is
  'Permanent XP earned by the active companion. Separate from player/user XP.';


-- =========================================================
-- 2. FOOD HAS A SEPARATE COMPANION-XP VALUE
-- =========================================================
-- Existing food already has companion_hp and user_xp. We keep user_xp for
-- Explorer progression and add companion_xp for companion progression.
-- For existing food, companion XP starts equal to the current user XP value.
-- =========================================================

alter table private.companion_food_catalog
  add column if not exists companion_xp integer;

update private.companion_food_catalog
set companion_xp = user_xp
where companion_xp is null;

alter table private.companion_food_catalog
  alter column companion_xp set default 1,
  alter column companion_xp set not null;

alter table private.companion_food_catalog
  drop constraint if exists companion_food_catalog_companion_xp_check;

alter table private.companion_food_catalog
  add constraint companion_food_catalog_companion_xp_check
  check (companion_xp > 0);


-- Keep an immutable copy of the companion XP actually awarded for each feed.
alter table private.companion_food_consumptions
  add column if not exists companion_xp_awarded integer;

update private.companion_food_consumptions as consumption
set companion_xp_awarded = consumption.user_xp_awarded
where consumption.companion_xp_awarded is null;

alter table private.companion_food_consumptions
  alter column companion_xp_awarded set not null;

alter table private.companion_food_consumptions
  drop constraint if exists companion_food_consumptions_companion_xp_awarded_check;

alter table private.companion_food_consumptions
  add constraint companion_food_consumptions_companion_xp_awarded_check
  check (companion_xp_awarded > 0);


-- =========================================================
-- 3. GROWTH LEVELS USE XP + HP TOGETHER
-- =========================================================
-- We intentionally keep the existing requirement curve so current players do
-- not suddenly face a completely different economy. The only change is that
-- BOTH companion XP and Growth HP now move the level bar.
-- =========================================================

create or replace function private.companion_growth_required_for_level(
  p_level integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(
    100 * power(greatest(1, p_level)::numeric, 1.25)
  )::integer;
$$;

create or replace function private.companion_level_from_growth(
  p_companion_xp bigint,
  p_growth_hp bigint
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
  v_remaining bigint := greatest(0, p_companion_xp) + greatest(0, p_growth_hp);
  v_required integer;
begin
  loop
    v_required := private.companion_growth_required_for_level(v_level);
    exit when v_remaining < v_required;

    v_remaining := v_remaining - v_required;
    v_level := v_level + 1;
  end loop;

  return v_level;
end;
$$;

create or replace function private.companion_life_stage_from_level(
  p_level integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when greatest(1, p_level) >= 7 then 'adult'
    when greatest(1, p_level) >= 4 then 'teen'
    else 'baby'
  end;
$$;

comment on function private.companion_life_stage_from_level(integer) is
  'Baby = levels 1-3, Teen = levels 4-6, Adult = level 7+.';


-- =========================================================
-- 4. EGG HATCH REWARD BANK
-- =========================================================
-- The current egg UI still tracks walking separately. This bank stores the
-- relic XP + HP earned BEFORE the player has an active companion. The egg UI
-- can consume/display these values as bonus hatch progress without losing the
-- existing walking requirement.
-- =========================================================

create table if not exists private.user_egg_growth_bank (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  hatch_xp bigint not null default 0
    check (hatch_xp >= 0),

  hatch_hp bigint not null default 0
    check (hatch_hp >= 0),

  updated_at timestamptz not null default now()
);

create or replace function public.server_get_my_egg_growth_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bank private.user_egg_growth_bank%rowtype;
begin
  if v_user_id is null then
    raise exception using message = 'UNAUTHORIZED', errcode = '42501';
  end if;

  insert into private.user_egg_growth_bank (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into strict v_bank
  from private.user_egg_growth_bank
  where user_id = v_user_id;

  return jsonb_build_object(
    'hatchXp', v_bank.hatch_xp,
    'hatchHp', v_bank.hatch_hp,
    'hatchPoints', v_bank.hatch_xp + v_bank.hatch_hp,
    'updatedAt', v_bank.updated_at
  );
end;
$$;

revoke all
on function public.server_get_my_egg_growth_progress()
from public, anon;

grant execute
on function public.server_get_my_egg_growth_progress()
to authenticated;


-- =========================================================
-- 5. RELIC -> EGG OR COMPANION
-- =========================================================
-- Relic XP already exists in user_relic_collections.xp_awarded.
-- Growth HP is intentionally rarity-based:
--   common     8 HP
--   uncommon  12 HP
--   rare      20 HP
--   epic      30 HP
--   legendary 40 HP
--   mythic    55 HP
--
-- If no active companion exists yet, the exact same XP/HP is banked for the
-- egg. Once a companion exists, future relics grow the active companion.
-- =========================================================

create or replace function private.relic_growth_hp_for_rarity(
  p_rarity text
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_rarity, ''))
    when 'mythic' then 55
    when 'legendary' then 40
    when 'epic' then 30
    when 'rare' then 20
    when 'uncommon' then 12
    else 8
  end;
$$;

create or replace function private.reward_growth_from_relic_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rarity text;
  v_hp integer;
  v_has_active_companion boolean := false;
  v_new_level integer;
begin
  select catalog.rarity
  into v_rarity
  from public.relic_catalog as catalog
  where catalog.relic_id = new.relic_id;

  v_hp := private.relic_growth_hp_for_rarity(v_rarity);

  select exists (
    select 1
    from private.user_companion_progress as progress
    where progress.user_id = new.user_id
      and progress.companion_id is not null
  )
  into v_has_active_companion;

  if v_has_active_companion then
    update private.user_companion_progress
    set
      companion_xp = companion_xp + greatest(0, new.xp_awarded),
      growth_hp = growth_hp + v_hp,
      updated_at = clock_timestamp()
    where user_id = new.user_id;

    select private.companion_level_from_growth(
      progress.companion_xp,
      progress.growth_hp
    )
    into v_new_level
    from private.user_companion_progress as progress
    where progress.user_id = new.user_id;

    update private.user_companion_progress
    set
      companion_level = v_new_level,
      updated_at = clock_timestamp()
    where user_id = new.user_id;
  else
    insert into private.user_egg_growth_bank (
      user_id,
      hatch_xp,
      hatch_hp,
      updated_at
    )
    values (
      new.user_id,
      greatest(0, new.xp_awarded),
      v_hp,
      clock_timestamp()
    )
    on conflict (user_id)
    do update set
      hatch_xp = private.user_egg_growth_bank.hatch_xp + excluded.hatch_xp,
      hatch_hp = private.user_egg_growth_bank.hatch_hp + excluded.hatch_hp,
      updated_at = clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists reward_growth_after_relic_collection
on public.user_relic_collections;

create trigger reward_growth_after_relic_collection
after insert
on public.user_relic_collections
for each row
execute function private.reward_growth_from_relic_collection();


-- =========================================================
-- 6. FOOD -> COMPANION XP
-- =========================================================
-- Existing server_consume_companion_food already adds the food's Growth HP.
-- This trigger adds the food's companion XP ONCE using the immutable
-- consumption ledger, then recalculates the level from combined XP + HP.
-- This means food won in games/missions becomes useful progression when fed,
-- rather than silently awarding twice when merely collected into inventory.
-- =========================================================

create or replace function private.reward_companion_xp_after_food_consumption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog_xp integer;
  v_new_level integer;
begin
  select catalog.companion_xp
  into v_catalog_xp
  from private.companion_food_catalog as catalog
  where catalog.food_id = new.food_id;

  v_catalog_xp := greatest(
    1,
    coalesce(new.companion_xp_awarded, v_catalog_xp, new.user_xp_awarded)
  );

  update private.user_companion_progress
  set
    companion_xp = companion_xp + v_catalog_xp,
    updated_at = clock_timestamp()
  where user_id = new.user_id
    and companion_id is not null;

  if found then
    select private.companion_level_from_growth(
      progress.companion_xp,
      progress.growth_hp
    )
    into v_new_level
    from private.user_companion_progress as progress
    where progress.user_id = new.user_id;

    update private.user_companion_progress
    set
      companion_level = v_new_level,
      updated_at = clock_timestamp()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists reward_companion_xp_after_food_consumption
on private.companion_food_consumptions;

create trigger reward_companion_xp_after_food_consumption
after insert
on private.companion_food_consumptions
for each row
execute function private.reward_companion_xp_after_food_consumption();


-- =========================================================
-- 7. MAKE NEW FOOD CONSUMPTIONS STORE THE CATALOG XP
-- =========================================================
-- server_consume_companion_food currently inserts user_xp_awarded but does not
-- know about the new column. BEFORE INSERT fills companion_xp_awarded from the
-- server-owned catalog. The client still cannot choose reward values.
-- =========================================================

create or replace function private.fill_companion_food_xp_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.companion_xp_awarded is null then
    select catalog.companion_xp
    into new.companion_xp_awarded
    from private.companion_food_catalog as catalog
    where catalog.food_id = new.food_id;
  end if;

  new.companion_xp_awarded := greatest(
    1,
    coalesce(new.companion_xp_awarded, new.user_xp_awarded)
  );

  return new;
end;
$$;

drop trigger if exists fill_companion_food_xp_award
on private.companion_food_consumptions;

create trigger fill_companion_food_xp_award
before insert
on private.companion_food_consumptions
for each row
execute function private.fill_companion_food_xp_award();


-- =========================================================
-- 8. COMPANION PROGRESS RESPONSE
-- =========================================================
-- Keep the old HP field names for backward compatibility while also exposing
-- clearer combined-growth fields for the upgraded UI.
-- =========================================================

create or replace function public.server_get_companion_progress(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress private.user_companion_progress%rowtype;
  v_config private.companion_reward_config%rowtype;

  v_level integer := 1;
  v_stage text := 'baby';
  v_growth_points bigint := 0;
  v_points_before_level bigint := 0;
  v_points_into_level bigint := 0;
  v_points_required integer := 100;
  v_counter integer;
begin
  select *
  into strict v_config
  from private.companion_reward_config
  where singleton;

  select *
  into v_progress
  from private.user_companion_progress
  where user_id = p_user_id;

  if not found
     or v_progress.companion_id is null
  then
    return jsonb_build_object(
      'companionId', null,
      'bondPoints', 0,
      'bondTier', 1,
      'bondPercent', 0,
      'energy', 0,
      'maximumEnergy', v_config.maximum_energy,
      'growthHp', 0,
      'companionXp', 0,
      'growthPoints', 0,
      'companionLevel', 1,
      'lifeStage', 'baby',
      'growthIntoLevel', 0,
      'growthRequired', 100,
      'hpIntoLevel', 0,
      'hpRequired', 100
    );
  end if;

  v_growth_points :=
    greatest(0, v_progress.growth_hp)
    + greatest(0, v_progress.companion_xp);

  v_level := private.companion_level_from_growth(
    v_progress.companion_xp,
    v_progress.growth_hp
  );

  v_stage := private.companion_life_stage_from_level(v_level);

  if v_level > 1 then
    for v_counter in 1..(v_level - 1)
    loop
      v_points_before_level :=
        v_points_before_level
        + private.companion_growth_required_for_level(v_counter);
    end loop;
  end if;

  v_points_required := private.companion_growth_required_for_level(v_level);
  v_points_into_level := greatest(0, v_growth_points - v_points_before_level);

  return jsonb_build_object(
    'companionId', v_progress.companion_id,
    'bondPoints', v_progress.bond_points,
    'bondTier', floor(v_progress.bond_points::numeric / v_config.bond_points_per_tier) + 1,
    'bondPercent', least(100, floor(
      mod(v_progress.bond_points, v_config.bond_points_per_tier)::numeric
      * 100 / v_config.bond_points_per_tier
    )),
    'energy', least(v_config.maximum_energy, v_progress.energy),
    'maximumEnergy', v_config.maximum_energy,
    'growthHp', greatest(0, v_progress.growth_hp),
    'companionXp', greatest(0, v_progress.companion_xp),
    'growthPoints', v_growth_points,
    'companionLevel', v_level,
    'lifeStage', v_stage,
    'growthIntoLevel', v_points_into_level,
    'growthRequired', v_points_required,

    -- Backward-compatible aliases used by the existing app today.
    'hpIntoLevel', v_points_into_level,
    'hpRequired', v_points_required
  );
end;
$$;

revoke all
on function public.server_get_companion_progress(uuid)
from public, anon, authenticated;

grant execute
on function public.server_get_companion_progress(uuid)
to service_role;


-- =========================================================
-- 9. BACKFILL EXISTING PLAYERS ONCE
-- =========================================================
-- Food HP has already been counted by the old feed RPC, so we only backfill
-- companion XP from food. For relics we add both companion XP and rarity HP.
-- Users without an active companion receive their historical relic rewards in
-- the egg bank instead.
-- =========================================================

with food_xp as (
  select
    consumption.user_id,
    coalesce(sum(consumption.companion_xp_awarded), 0)::bigint as xp
  from private.companion_food_consumptions as consumption
  group by consumption.user_id
),
relic_growth as (
  select
    collection.user_id,
    coalesce(sum(collection.xp_awarded), 0)::bigint as xp,
    coalesce(sum(
      private.relic_growth_hp_for_rarity(catalog.rarity)
    ), 0)::bigint as hp
  from public.user_relic_collections as collection
  join public.relic_catalog as catalog
    on catalog.relic_id = collection.relic_id
  group by collection.user_id
)
update private.user_companion_progress as progress
set
  companion_xp = greatest(
    progress.companion_xp,
    coalesce(food_xp.xp, 0) + coalesce(relic_growth.xp, 0)
  ),
  growth_hp = progress.growth_hp + coalesce(relic_growth.hp, 0),
  updated_at = clock_timestamp()
from food_xp
full join relic_growth
  on relic_growth.user_id = food_xp.user_id
where progress.user_id = coalesce(food_xp.user_id, relic_growth.user_id)
  and progress.companion_id is not null;

update private.user_companion_progress as progress
set
  companion_level = private.companion_level_from_growth(
    progress.companion_xp,
    progress.growth_hp
  ),
  updated_at = clock_timestamp()
where progress.companion_id is not null;

insert into private.user_egg_growth_bank (
  user_id,
  hatch_xp,
  hatch_hp,
  updated_at
)
select
  collection.user_id,
  coalesce(sum(collection.xp_awarded), 0)::bigint,
  coalesce(sum(
    private.relic_growth_hp_for_rarity(catalog.rarity)
  ), 0)::bigint,
  clock_timestamp()
from public.user_relic_collections as collection
join public.relic_catalog as catalog
  on catalog.relic_id = collection.relic_id
where not exists (
  select 1
  from private.user_companion_progress as progress
  where progress.user_id = collection.user_id
    and progress.companion_id is not null
)
group by collection.user_id
on conflict (user_id)
do update set
  hatch_xp = greatest(
    private.user_egg_growth_bank.hatch_xp,
    excluded.hatch_xp
  ),
  hatch_hp = greatest(
    private.user_egg_growth_bank.hatch_hp,
    excluded.hatch_hp
  ),
  updated_at = clock_timestamp();

commit;
