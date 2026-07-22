begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'daily-progress@example.test', '', now(), now(), now()
);

select is(private.valid_timezone_or_utc('America/Los_Angeles'), 'America/Los_Angeles', 'valid IANA timezone is retained');
select is(private.valid_timezone_or_utc('Invalid/Timezone'), 'UTC', 'invalid timezone safely falls back to UTC');
select is(
  (select local_date from private.user_local_context('11111111-1111-4111-8111-111111111111', '2026-03-08 07:30:00+00')),
  date '2026-03-08',
  'missing timezone safely uses UTC'
);

do $$ begin
  perform * from public.server_set_user_timezone(
    '11111111-1111-4111-8111-111111111111', 'America/Los_Angeles'
  );
end $$;
select is(
  (select local_date from private.user_local_context('11111111-1111-4111-8111-111111111111', '2026-03-08 07:30:00+00')),
  date '2026-03-07',
  'local day is correct before the spring DST transition'
);
select is(
  (select local_date from private.user_local_context('11111111-1111-4111-8111-111111111111', '2026-03-08 10:30:00+00')),
  date '2026-03-08',
  'local day is correct after the spring DST transition'
);
select isnt(
  private.ensure_daily_progress('11111111-1111-4111-8111-111111111111', '2026-03-08 07:30:00+00'),
  private.ensure_daily_progress('11111111-1111-4111-8111-111111111111', '2026-03-08 10:30:00+00'),
  'daily progress resets when the stored timezone enters a new local day'
);

select is(
  (select (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'rare'->>'earned')::boolean),
  false,
  'Rare is locked below five verified miles'
);
select is(
  (select (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'legendary'->>'earned')::boolean),
  false,
  'Legendary is locked below ten verified miles'
);

select ok(
  not has_function_privilege('authenticated', 'public.server_record_verified_segment(uuid,uuid,text,text,text,double precision,timestamptz,timestamptz,integer,double precision)', 'EXECUTE'),
  'clients cannot forge verified distance segments'
);
select ok(
  not has_table_privilege('authenticated', 'private.user_daily_progress', 'UPDATE'),
  'clients cannot forge eligibility flags'
);
select ok(
  not has_table_privilege('authenticated', 'private.daily_mission_completion', 'UPDATE'),
  'clients cannot forge mission completion'
);

with batch as (
  select batch_id from public.server_begin_distance_batch(
    '11111111-1111-4111-8111-111111111111', 'gps', repeat('a', 64), 2
  )
)
select is(result.accepted, true, 'exactly five verified miles is accepted')
from batch
cross join lateral public.server_record_verified_segment(
    '11111111-1111-4111-8111-111111111111', batch.batch_id, 'gps', repeat('b', 64),
    'walking', 8046.72,
    clock_timestamp() - interval '20 minutes', clock_timestamp() - interval '5 minutes', 900, 8.9408
  ) as result;
select is(
  (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'rare'->>'earned')::boolean,
  true,
  'Rare is earned at exactly five verified miles'
);
select is(
  (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'legendary'->>'earned')::boolean,
  false,
  'Legendary remains locked below ten verified miles'
);
select is(
  (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'rare'->>'active')::boolean,
  false,
  'new eligibility waits for the next spawn window'
);
select is(
  (public.server_get_verified_daily_progress('11111111-1111-4111-8111-111111111111')->'missionOverride'->>'earned')::boolean,
  false,
  'partial required mission completion does not grant the override'
);

with batch as (
  select batch_id from public.server_begin_distance_batch(
    '11111111-1111-4111-8111-111111111111', 'healthkit', repeat('c', 64), 1
  )
)
select is(result.rejection_code, 'overlapping_activity', 'overlapping health and GPS activity is not double-counted')
from batch
cross join lateral public.server_record_verified_segment(
    '11111111-1111-4111-8111-111111111111', batch.batch_id, 'healthkit', repeat('d', 64),
    'walking', 1000,
    clock_timestamp() - interval '15 minutes', clock_timestamp() - interval '10 minutes', 300, 3.3333
  ) as result;

with existing_batch as (
  select id from private.distance_ingestion_batches
  where user_id = '11111111-1111-4111-8111-111111111111' and provider = 'gps' limit 1
)
select is(result.counted_distance_meters, 8046.72::numeric, 'replayed segment returns the original result without adding distance')
from existing_batch
cross join lateral public.server_record_verified_segment(
    '11111111-1111-4111-8111-111111111111', existing_batch.id, 'gps', repeat('b', 64),
    'walking', 8046.72,
    clock_timestamp() - interval '20 minutes', clock_timestamp() - interval '5 minutes', 900, 8.9408
  ) as result;

select is(
  (select verified_distance_meters from private.user_daily_progress
   where user_id = '11111111-1111-4111-8111-111111111111' order by local_date desc limit 1),
  8046.720::numeric,
  'replay and overlap leave the aggregate unchanged'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '22222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mission-override@example.test', '', now(), now(), now()
);

with batch as (
  select batch_id from public.server_begin_distance_batch(
    '22222222-2222-4222-8222-222222222222', 'gps', repeat('e', 64), 2
  )
)
select is(result.accepted, true, 'a plausible verified mission activity is accepted')
from batch
cross join lateral public.server_record_verified_segment(
    '22222222-2222-4222-8222-222222222222', batch.batch_id, 'gps', repeat('f', 64),
    'walking', 1609.344,
    clock_timestamp() - interval '30 minutes', clock_timestamp() - interval '10 minutes', 1200, 1.34112
  ) as result;
select is(
  (public.server_get_verified_daily_progress('22222222-2222-4222-8222-222222222222')->'missionOverride'->>'earned')::boolean,
  true,
  'all required missions grant the backend override'
);
select is(
  (public.server_get_verified_daily_progress('22222222-2222-4222-8222-222222222222')->'legendary'->>'earned')::boolean,
  true,
  'mission override earns Legendary below ten miles'
);

rollback;
