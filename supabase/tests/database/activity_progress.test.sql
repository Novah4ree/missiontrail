begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'activity-progress@example.test', '',
  now(), now(), now()
);

do $$ begin
  perform * from public.server_set_user_timezone(
    '33333333-3333-4333-8333-333333333333', 'UTC'
  );
end $$;

insert into private.daily_mission_definitions (
  mission_id, title, metric, target_value, is_required, sort_order,
  reward_xp, reward_bond_xp, reward_energy_restore
) values (
  'test-device-steps', 'Walk 1,000 Steps', 'verified_steps', 1000, true, 5,
  50, 3, 5
)
on conflict (mission_id) do update set
  metric = excluded.metric,
  target_value = excluded.target_value,
  reward_bond_xp = excluded.reward_bond_xp,
  reward_energy_restore = excluded.reward_energy_restore,
  is_enabled = true;

select is(
  (select result.step_count from public.server_record_device_steps(
    '33333333-3333-4333-8333-333333333333',
    current_date, 500, '33333333:steps:500'
  ) as result),
  500,
  'device steps are recorded for the server-approved local day'
);

select is(
  (select result.step_count from public.server_record_device_steps(
    '33333333-3333-4333-8333-333333333333',
    current_date, 500, '33333333:steps:500'
  ) as result),
  500,
  'replaying an identical step report does not add steps'
);

select is(
  (select result.step_count from public.server_record_device_steps(
    '33333333-3333-4333-8333-333333333333',
    current_date, 400, '33333333:steps:400'
  ) as result),
  500,
  'a lower device total never subtracts daily steps'
);

select is(
  (select result.step_count from public.server_record_device_steps(
    '33333333-3333-4333-8333-333333333333',
    current_date, 1000, '33333333:steps:1000'
  ) as result),
  1000,
  'a higher device total advances daily steps'
);

select is(
  (select status from private.daily_mission_completion
   where user_id = '33333333-3333-4333-8333-333333333333'
     and mission_id = 'test-device-steps'),
  'completed',
  'the step mission completes only after its measured target'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_record_device_steps(uuid,date,integer,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the trusted step-recording RPC directly'
);

select is(
  (public.server_get_companion_progress(
    '33333333-3333-4333-8333-333333333333'
  )->>'companionId'),
  null,
  'reading progress does not invent an active companion'
);

insert into private.user_companion_progress (user_id, companion_id, energy)
values ('33333333-3333-4333-8333-333333333333', 'novah', 98)
on conflict (user_id) do update
set companion_id = excluded.companion_id, energy = excluded.energy;

select is(
  (public.server_get_companion_progress(
    '33333333-3333-4333-8333-333333333333'
  )->>'companionId'),
  'novah',
  'a persisted active companion is returned'
);

insert into private.xp_ledger (user_id, source_type, source_id, xp_delta)
select
  '33333333-3333-4333-8333-333333333333',
  'mission',
  completion.id,
  50
from private.daily_mission_completion as completion
where completion.user_id = '33333333-3333-4333-8333-333333333333'
  and completion.mission_id = 'test-device-steps'
on conflict (user_id, source_type, source_id) do nothing;

select is(
  (public.server_get_companion_progress(
    '33333333-3333-4333-8333-333333333333'
  )->>'bondPoints')::integer,
  3,
  'one verified walking mission XP insert awards the configured Bond points'
);

select is(
  (public.server_get_companion_progress(
    '33333333-3333-4333-8333-333333333333'
  )->>'energy')::integer,
  100,
  'mission Energy restoration is clamped to maximum Energy'
);

insert into private.xp_ledger (user_id, source_type, source_id, xp_delta)
select
  '33333333-3333-4333-8333-333333333333',
  'mission',
  completion.id,
  50
from private.daily_mission_completion as completion
where completion.user_id = '33333333-3333-4333-8333-333333333333'
  and completion.mission_id = 'test-device-steps'
on conflict (user_id, source_type, source_id) do nothing;

select is(
  (public.server_get_companion_progress(
    '33333333-3333-4333-8333-333333333333'
  )->>'bondPoints')::integer,
  3,
  'replaying the same mission reward cannot award Bond twice'
);

rollback;
