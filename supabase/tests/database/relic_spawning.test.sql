begin;

select plan(31);

select ok(
  exists (select 1 from public.relic_catalog where rarity = 'common' and is_enabled),
  'normal play has at least one enabled Common relic'
);

select ok(
  exists (select 1 from public.relic_catalog where rarity = 'uncommon' and is_enabled),
  'normal play has at least one enabled Uncommon relic'
);

select is(
  private.spawn_window_id('2026-07-19 12:00:00+00'::timestamptz),
  private.spawn_window_id('2026-07-19 12:29:59.999+00'::timestamptz),
  'times inside one 30-minute block share a window ID'
);

select isnt(
  private.spawn_window_id('2026-07-19 12:29:59.999+00'::timestamptz),
  private.spawn_window_id('2026-07-19 12:30:00+00'::timestamptz),
  'the window ID changes exactly at a 30-minute boundary'
);

select ok(
  private.assignment_is_active(
    '2026-07-19 12:30:00+00',
    '2026-07-19 12:32:00+00',
    null,
    '2026-07-19 12:29:59+00'
  ),
  'an assignment is active before normal expiration'
);

select ok(
  private.assignment_is_active(
    '2026-07-19 12:30:00+00',
    '2026-07-19 12:32:00+00',
    '2026-07-19 12:29:30+00',
    '2026-07-19 12:31:00+00'
  ),
  'grace applies when verification began before expiration'
);

select ok(
  not private.assignment_is_active(
    '2026-07-19 12:30:00+00',
    '2026-07-19 12:32:00+00',
    null,
    '2026-07-19 12:31:00+00'
  ),
  'grace does not apply when verification never began'
);

select ok(
  not private.assignment_is_active(
    '2026-07-19 12:30:00+00',
    '2026-07-19 12:32:00+00',
    '2026-07-19 12:29:30+00',
    '2026-07-19 12:32:01+00'
  ),
  'an assignment expires after its grace period'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated clients cannot use the private schema'
);

select ok(
  not has_table_privilege('authenticated', 'private.relic_spawn_candidates', 'SELECT'),
  'authenticated clients cannot select exact spawn candidates'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_list_spawn_candidates(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the server exact-coordinate routine'
);

select ok(
  position(
    'exact' in lower(pg_get_function_result(
      'public.server_list_client_mystery_zones(uuid,uuid)'::regprocedure
    ))
  ) = 0,
  'the client mystery response has no exact-coordinate result field'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_relic_collections'
      and column_name in ('exact_point', 'latitude', 'longitude')
  ),
  'the public collection inventory contains no coordinates'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.user_relic_assignments'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%user_id, spawn_candidate_id%'
  ),
  'duplicate user assignments are prevented'
);

select ok(
  pg_get_functiondef(
    'public.server_assign_relic_candidate(uuid,uuid,uuid,double precision,double precision,double precision,integer)'::regprocedure
  ) like '%exploration_zone_id = excluded.exploration_zone_id%'
  and pg_get_functiondef(
    'public.server_assign_relic_candidate(uuid,uuid,uuid,double precision,double precision,double precision,integer)'::regprocedure
  ) like '%expires_at = excluded.expires_at%'
  and pg_get_functiondef(
    'public.server_assign_relic_candidate(uuid,uuid,uuid,double precision,double precision,double precision,integer)'::regprocedure
  ) like '%when user_relic_assignments.status in (%',
  'reused candidates refresh stale assignment fields without blindly resetting protected states'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_relic_collections'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%user_id, relic_id%'
  ),
  'duplicate user relic collections are prevented'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_relic_collections'::regclass),
  'RLS is enabled on public collection inventory'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.relic_spawn_candidates'::regclass),
  'RLS is enabled on exact spawn candidates'
);

select ok(
  pg_get_functiondef(
    'public.server_get_or_create_current_spawn_window(text,double precision,double precision,integer,integer)'::regprocedure
  ) like '%clock_timestamp()%'
  and pg_get_function_arguments(
    'public.server_get_or_create_current_spawn_window(text,double precision,double precision,integer,integer)'::regprocedure
  ) not like '%p_now%',
  'the public window routine uses server time and accepts no client time'
);

select ok(
  pg_get_functiondef(
    'public.server_get_safe_spawn_locations(text,double precision,double precision,double precision)'::regprocedure
  ) not like '%location.region_geohash = p_region_geohash%'
  and pg_get_functiondef(
    'public.server_get_safe_spawn_locations(text,double precision,double precision,double precision)'::regprocedure
  ) like '%st_dwithin%',
  'safe spawn lookup is spatial and works across imported geohash precisions'
);

select ok(
  pg_get_functiondef(
    'public.server_get_or_create_exploration_zone(uuid,text,double precision,double precision,text)'::regprocedure
  ) like '%assignment.status in (''verification'', ''revealed'')%',
  'moving between dense field cells preserves an active secure reveal flow'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'relic_spawn_candidates'
      and column_name = 'spawn_tier'
  ),
  'spawn candidates carry a server-authored encounter tier'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname = 'relic_spawn_candidates_one_ambient_per_user_window_idx'
  ),
  'at most one ambient candidate exists per user and window'
);

select ok(
  pg_get_functiondef(
    'public.server_save_ambient_spawn_candidate(uuid,uuid,text,double precision,double precision,text)'::regprocedure
  ) like '%rarity in (''common'', ''uncommon'')%'
  and pg_get_functiondef(
    'public.server_save_ambient_spawn_candidate(uuid,uuid,text,double precision,double precision,text)'::regprocedure
  ) like '%st_dwithin%'
  and pg_get_functiondef(
    'public.server_save_ambient_spawn_candidate(uuid,uuid,text,double precision,double precision,text)'::regprocedure
  ) like '%zone_anchor%',
  'ambient creation requires Common/Uncommon rarity and a fresh verified anchor'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.server_save_ambient_spawn_candidate(uuid,uuid,text,double precision,double precision,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot create ambient candidates directly'
);

select ok(
  pg_get_function_result(
    'public.server_list_client_mystery_zones(uuid,uuid)'::regprocedure
  ) like '%encounter_type text%'
  and pg_get_function_result(
    'public.server_list_nearby_relic_contexts(uuid)'::regprocedure
  ) like '%encounter_type text%',
  'client-safe and service-only navigation paths distinguish ambient encounters'
);

select ok(
  pg_get_functiondef(
    'public.server_list_nearby_relic_contexts(uuid)'::regprocedure
  ) like '%assignment.eligibility_status in (''eligible'', ''overridden'', ''locked'')%'
  and not has_function_privilege(
    'authenticated',
    'public.server_list_nearby_relic_contexts(uuid)',
    'EXECUTE'
  ),
  'radar includes opaque locked contexts only through its service-role function'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '66666666-6666-4666-8666-666666666666',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ambient@example.test', '',
  now(), now(), now()
);

insert into private.relic_spawn_windows (
  id, window_id, region_geohash, zone_center, starts_at, ends_at, grace_ends_at
) values (
  '60000000-0000-4000-8000-000000000001', 999999, '9q8yyk8',
  extensions.st_setsrid(
    extensions.st_makepoint(-122, 37), 4326
  )::extensions.geography,
  clock_timestamp() - interval '5 minutes',
  clock_timestamp() + interval '25 minutes',
  clock_timestamp() + interval '27 minutes'
);

insert into private.location_verification_attempts (
  user_id, purpose, status, accurate_reading_count, maximum_accuracy_meters,
  median_point, payload_digest, verified_at
) values (
  '66666666-6666-4666-8666-666666666666', 'zone_anchor', 'verified', 3, 8,
  extensions.st_setsrid(
    extensions.st_makepoint(-122, 37), 4326
  )::extensions.geography,
  repeat('a', 64), clock_timestamp()
);

create temporary table ambient_candidate_results(candidate_id uuid);
insert into ambient_candidate_results
select public.server_save_ambient_spawn_candidate(
  '66666666-6666-4666-8666-666666666666',
  '60000000-0000-4000-8000-000000000001',
  (select relic_id from public.relic_catalog
   where is_enabled and rarity = 'common' order by relic_id limit 1),
  37, -122, repeat('b', 64)
);
insert into ambient_candidate_results
select public.server_save_ambient_spawn_candidate(
  '66666666-6666-4666-8666-666666666666',
  '60000000-0000-4000-8000-000000000001',
  (select relic_id from public.relic_catalog
   where is_enabled and rarity = 'uncommon' order by relic_id limit 1),
  37, -122, repeat('c', 64)
);

select is(
  (select count(distinct candidate_id)::integer from ambient_candidate_results),
  1,
  'repeated ambient creation returns the same per-user/window candidate'
);

select is(
  (
    select count(*)::integer
    from private.relic_spawn_candidates
    where spawn_window_id = '60000000-0000-4000-8000-000000000001'
      and owner_user_id = '66666666-6666-4666-8666-666666666666'
      and spawn_tier = 'ambient'
  ),
  1,
  'ambient creation persists exactly one owned candidate'
);

select ok(
  exists (
    select 1
    from private.relic_spawn_candidates
    where spawn_window_id = '60000000-0000-4000-8000-000000000001'
      and spawn_tier = 'ambient'
      and rarity in ('common', 'uncommon')
      and safety_status = 'verified_vicinity'
      and extensions.st_dwithin(
        exact_point,
        extensions.st_setsrid(
          extensions.st_makepoint(-122, 37), 4326
        )::extensions.geography,
        0.01
      )
  ),
  'ambient point remains inside the verified player-area anchor'
);

create temporary table assignment_zone_results as
select *
from public.server_get_or_create_exploration_zone(
  '66666666-6666-4666-8666-666666666666',
  '9q8yyk8',
  37,
  -122,
  'verified_gps'
);

create temporary table assignment_results(assignment_id uuid);
insert into assignment_results
select public.server_assign_relic_candidate(
  '66666666-6666-4666-8666-666666666666',
  (select zone_id from assignment_zone_results limit 1),
  (select candidate_id from ambient_candidate_results limit 1),
  37.0001,
  -122.0001,
  120,
  80
);

update private.user_relic_assignments
set status = 'expired',
    eligibility_status = 'locked',
    mystery_radius_meters = 999,
    clue_distance_band_meters = 999,
    expires_at = clock_timestamp() - interval '10 minutes',
    grace_ends_at = clock_timestamp() - interval '5 minutes'
where id = (select assignment_id from assignment_results limit 1);

select public.server_assign_relic_candidate(
  '66666666-6666-4666-8666-666666666666',
  (select zone_id from assignment_zone_results limit 1),
  (select candidate_id from ambient_candidate_results limit 1),
  37.0002,
  -122.0002,
  120,
  80
);

select ok(
  exists (
    select 1
    from private.user_relic_assignments as assignment
    where assignment.id = (select assignment_id from assignment_results limit 1)
      and assignment.status = 'active'
      and assignment.eligibility_status = 'eligible'
      and assignment.mystery_radius_meters = 120
      and assignment.clue_distance_band_meters = 80
      and assignment.expires_at > clock_timestamp()
      and assignment.grace_ends_at >= assignment.expires_at
  ),
  'reassigning an expired deterministic candidate restores current active metadata'
);

select * from finish();
rollback;
