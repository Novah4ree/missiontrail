begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mission-rewards@example.test', '',
  now(), now(), now()
);

do $$ begin
  perform * from public.server_set_user_timezone(
    '44444444-4444-4444-8444-444444444444', 'UTC'
  );
end $$;

insert into private.daily_mission_definitions (
  mission_id, title, metric, target_value, is_required, sort_order,
  reward_xp, reward_bond_xp, reward_energy_restore
) values (
  'test-multi-level-reward', 'Cross Two Levels', 'verified_steps', 1, true, 1,
  500, 3, 5
)
on conflict (mission_id) do update set
  reward_xp = excluded.reward_xp,
  reward_bond_xp = excluded.reward_bond_xp,
  reward_energy_restore = excluded.reward_energy_restore,
  is_enabled = true;

select private.ensure_daily_progress(
  '44444444-4444-4444-8444-444444444444',
  clock_timestamp()
);

update private.daily_mission_completion
set progress_value = target_value,
    status = 'completed',
    completed_at = clock_timestamp()
where user_id = '44444444-4444-4444-8444-444444444444'
  and mission_id = 'test-multi-level-reward';

insert into private.user_companion_progress (
  user_id, companion_id, bond_points, energy
) values (
  '44444444-4444-4444-8444-444444444444', 'novah', 0, 98
);

insert into private.player_level_milestones (
  level, reward_code, reward_payload
) values
  (2, 'test-level-2', '{"relic":"test-2"}'::jsonb),
  (3, 'test-level-3', '{"relic":"test-3"}'::jsonb)
on conflict (level) do update set
  reward_code = excluded.reward_code,
  reward_payload = excluded.reward_payload,
  is_enabled = true;

create temporary table first_claim as
select * from public.server_claim_mission_reward(
  '44444444-4444-4444-8444-444444444444',
  'test-multi-level-reward'
);

select is((select claimed from first_claim), true, 'verified mission claim succeeds');
select is((select result_code from first_claim), 'CLAIMED', 'claim returns the success code');
select is((select xp_awarded from first_claim), 500, 'configured XP is awarded once');
select is((select old_total_xp from first_claim), 0::bigint, 'claim returns old lifetime XP');
select is((select new_total_xp from first_claim), 500::bigint, 'claim returns new lifetime XP');
select is((select old_level from first_claim), 1, 'claim returns the old level');
select is((select new_level from first_claim), 3, 'one reward can cross multiple levels');
select is((select levels_gained from first_claim), 2, 'claim returns every level gained');
select is(
  jsonb_array_length((select milestone_rewards_crossed from first_claim)),
  2,
  'claim returns every crossed milestone reward'
);
select is(
  (select count(*) from private.xp_ledger
   where user_id = '44444444-4444-4444-8444-444444444444'),
  1::bigint,
  'atomic transaction writes one XP ledger row'
);
select is(
  (select idempotency_key from private.xp_ledger
   where user_id = '44444444-4444-4444-8444-444444444444'),
  concat(
    '44444444-4444-4444-8444-444444444444:test-multi-level-reward:',
    (select id from private.daily_mission_completion
     where user_id = '44444444-4444-4444-8444-444444444444'
       and mission_id = 'test-multi-level-reward')
  ),
  'idempotency key includes user, mission, and assignment IDs'
);
select is(
  (select status from private.daily_mission_completion
   where user_id = '44444444-4444-4444-8444-444444444444'
     and mission_id = 'test-multi-level-reward'),
  'claimed',
  'atomic transaction advances the mission state'
);
select is(
  (public.server_get_companion_progress(
    '44444444-4444-4444-8444-444444444444'
  )->>'bondPoints')::integer,
  3,
  'configured Bond XP is awarded to the active companion'
);
select is(
  (public.server_get_companion_progress(
    '44444444-4444-4444-8444-444444444444'
  )->>'energy')::integer,
  100,
  'Energy restoration is clamped at maximum Energy'
);

create temporary table replayed_claim as
select * from public.server_claim_mission_reward(
  '44444444-4444-4444-8444-444444444444',
  'test-multi-level-reward'
);

select is((select claimed from replayed_claim), false, 'offline replay is identified as duplicate');
select is((select result_code from replayed_claim), 'ALREADY_CLAIMED', 'duplicate claim is rejected safely');
select is((select xp_awarded from replayed_claim), 0, 'duplicate claim awards no XP');
select is(
  (select count(*) from private.xp_ledger
   where user_id = '44444444-4444-4444-8444-444444444444'),
  1::bigint,
  'offline replay cannot add another ledger row'
);
select is(
  (public.server_get_companion_progress(
    '44444444-4444-4444-8444-444444444444'
  )->>'bondPoints')::integer,
  3,
  'offline replay cannot add Bond twice'
);
select is(private.xp_required_for_level(1), 100, 'database XP curve has the exact Level 1 boundary');
select is(private.player_level_from_xp(420), 3, 'database XP curve supports multiple gained levels');
select is(
  public.server_get_daily_streak('44444444-4444-4444-8444-444444444444'),
  1,
  'a claimed mission creates a correctly labeled daily streak value'
);

rollback;
