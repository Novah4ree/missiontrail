begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'proximity@example.test', '', now(), now(), now()
);

insert into private.exploration_zones (
  id, user_id, region_geohash, region_center, active_until
) values (
  '40000000-0000-4000-8000-000000000001',
  '33333333-3333-4333-8333-333333333333', '9q8yy',
  extensions.st_setsrid(extensions.st_makepoint(-122, 37), 4326)::extensions.geography,
  clock_timestamp() + interval '2 hours'
);

insert into private.relic_spawn_windows (
  id, window_id, region_geohash, zone_center, starts_at, ends_at, grace_ends_at
) values (
  '40000000-0000-4000-8000-000000000002', 100, '9q8yy',
  extensions.st_setsrid(extensions.st_makepoint(-122, 37), 4326)::extensions.geography,
  clock_timestamp() - interval '5 minutes', clock_timestamp() + interval '25 minutes',
  clock_timestamp() + interval '27 minutes'
);

insert into private.relic_spawn_candidates (
  id, spawn_window_id, slot_index, relic_id, rarity, exact_point,
  safety_status, seed_digest
) values
  (
    '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002',
    0, 'nebula-crystal', 'epic',
    extensions.st_setsrid(extensions.st_makepoint(-122, 37), 4326)::extensions.geography,
    'verified', repeat('a', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002',
    1, 'star-fragment', 'rare',
    extensions.st_setsrid(extensions.st_makepoint(-122.001, 37.001), 4326)::extensions.geography,
    'verified', repeat('b', 64)
  );

insert into private.user_relic_assignments (
  id, user_id, exploration_zone_id, spawn_candidate_id, relic_id, rarity,
  eligibility_status, mystery_center, mystery_radius_meters,
  clue_distance_band_meters, status, expires_at, grace_ends_at,
  verification_started_at, revealed_at
) values
  (
    '40000000-0000-4000-8000-000000000005',
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'nebula-crystal', 'epic', 'eligible',
    extensions.st_setsrid(extensions.st_makepoint(-122.0004, 37.0004), 4326)::extensions.geography,
    75, 75, 'revealed', clock_timestamp() + interval '25 minutes',
    clock_timestamp() + interval '27 minutes', clock_timestamp(), clock_timestamp()
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    'star-fragment', 'rare', 'locked',
    extensions.st_setsrid(extensions.st_makepoint(-122.0014, 37.0014), 4326)::extensions.geography,
    75, 75, 'active', clock_timestamp() + interval '25 minutes',
    clock_timestamp() + interval '27 minutes', null, null
  );

select ok(
  not has_function_privilege('authenticated', 'public.server_get_proximity_context(uuid,uuid)', 'EXECUTE'),
  'authenticated clients cannot access exact proximity context'
);
select ok(
  not has_function_privilege('authenticated', 'public.server_list_nearby_relic_contexts(uuid)', 'EXECUTE'),
  'authenticated clients cannot search exact relic coordinates directly'
);
select is(
  (
    select count(*)
    from public.server_list_nearby_relic_contexts('33333333-3333-4333-8333-333333333333')
  ),
  1::bigint,
  'nearest search includes active eligible relics and excludes locked special relics'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_place_development_test_relic(uuid,uuid,uuid,text,double precision,double precision,double precision,double precision,double precision,integer,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot place test relics through the database'
);
select isnt(
  public.server_place_development_test_relic(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    'nebula-crystal',
    37.0000137,
    -122,
    37.0004,
    -122.0004,
    75,
    75,
    repeat('d', 64)
  ),
  null::uuid,
  'service-only helper creates a development test assignment'
);
select ok(
  position('exact_' in pg_get_function_result(
    'public.server_list_client_mystery_zones(uuid,uuid)'::regprocedure
  )::text) = 0,
  'client mystery response has no exact-coordinate field'
);
select is(
  (select eligible from public.server_get_proximity_context(
    '33333333-3333-4333-8333-333333333333', '40000000-0000-4000-8000-000000000005'
  )), true, 'normal rarity assignment is eligible'
);
select is(
  (select eligible from public.server_get_proximity_context(
    '33333333-3333-4333-8333-333333333333', '40000000-0000-4000-8000-000000000006'
  )), false, 'locked Rare assignment remains ineligible'
);
select is(private.assignment_is_active(now() - interval '1 minute', now() + interval '1 minute', now() - interval '2 minutes', now()), true, 'verification begun before expiry receives grace');
select is(private.assignment_is_active(now() - interval '2 minutes', now() - interval '1 minute', now() - interval '3 minutes', now()), false, 'assignment expires after grace ends');

insert into private.location_verification_attempts (
  id, user_id, assignment_id, purpose, status, accurate_reading_count,
  maximum_accuracy_meters, median_point, measured_distance_meters,
  radius_used_meters, payload_digest, verified_at
) values (
  '40000000-0000-4000-8000-000000000007',
  '33333333-3333-4333-8333-333333333333',
  '40000000-0000-4000-8000-000000000005', 'reveal', 'verified', 3, 4,
  extensions.st_setsrid(extensions.st_makepoint(-122, 37), 4326)::extensions.geography,
  2, 4.57, repeat('c', 64), clock_timestamp()
);

select is(
  (select status from public.server_issue_collection_challenge(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000007', 'device-one', repeat('d', 64)
  )), 'issued', 'short-lived collection challenge is issued after reveal'
);

select is(
  (select accepted from public.server_record_proximity_attempt(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000005', 'collection', repeat('c', 64),
    'revealed', 3, 4, 37, -122, 2, 4.57, null
  )),
  false,
  'the reveal sample batch cannot be replayed as the final collection check'
);

insert into private.location_verification_attempts (
  id, user_id, assignment_id, purpose, status, accurate_reading_count,
  maximum_accuracy_meters, median_point, measured_distance_meters,
  radius_used_meters, payload_digest, verified_at
) values (
  '40000000-0000-4000-8000-000000000008',
  '33333333-3333-4333-8333-333333333333',
  '40000000-0000-4000-8000-000000000005', 'collection', 'verified', 3, 4,
  extensions.st_setsrid(extensions.st_makepoint(-122, 37), 4326)::extensions.geography,
  2, 4.57, repeat('e', 64), clock_timestamp()
);

select is(
  (select was_new_collection from public.server_complete_relic_collection(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000005', repeat('d', 64),
    '40000000-0000-4000-8000-000000000008'
  )), true, 'first collection atomically creates a new Vault item'
);
select is((select count(*) from public.user_relic_collections where user_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'Vault contains one unique relic');
select is((select count(*) from private.xp_ledger where user_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'XP ledger contains one reward');
select is((select status from private.one_time_collection_challenges where token_hash = repeat('d', 64)), 'used', 'one-time challenge is consumed');
select is((select status from private.user_relic_assignments where id = '40000000-0000-4000-8000-000000000005'), 'collected', 'assignment completes in the same transaction');
select is(
  (select was_new_collection from public.server_complete_relic_collection(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000005', repeat('d', 64),
    '40000000-0000-4000-8000-000000000008'
  )), false, 'network retry returns the existing collection without another reward'
);
select is((select count(*) from private.xp_ledger where user_id = '33333333-3333-4333-8333-333333333333'), 1::bigint, 'duplicate tap cannot duplicate XP');

insert into private.one_time_collection_challenges (
  user_id, assignment_id, device_installation_id, purpose, token_hash,
  issued_at, expires_at, status
) values (
  '33333333-3333-4333-8333-333333333333',
  '40000000-0000-4000-8000-000000000006', 'device-one', 'collection', repeat('f', 64),
  clock_timestamp() - interval '2 minutes', clock_timestamp() - interval '1 minute', 'issued'
);
select throws_ok(
  $$select * from public.server_complete_relic_collection(
    '33333333-3333-4333-8333-333333333333',
    '40000000-0000-4000-8000-000000000006', repeat('f', 64),
    '40000000-0000-4000-8000-000000000008'
  )$$,
  'P0001', 'Collection challenge expired',
  'expired challenge cannot be consumed'
);

insert into private.location_verification_attempts (
  user_id, purpose, status, payload_digest, retained_until, created_at
) values (
  '33333333-3333-4333-8333-333333333333', 'distance', 'rejected', repeat('9', 64),
  clock_timestamp() - interval '1 hour', clock_timestamp() - interval '2 hours'
);
select is(
  (select proximity_rows_deleted from public.server_cleanup_expired_location_data()),
  1, 'retention cleanup deletes expired proximity evidence'
);
select is(
  (select count(*) from public.user_relic_collections where user_id = '33333333-3333-4333-8333-333333333333'),
  1::bigint, 'cleanup never removes coordinate-free Vault records'
);

rollback;
