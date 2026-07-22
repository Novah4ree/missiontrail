begin;

select plan(18);

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
    'public.server_list_spawn_candidates(uuid)',
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

select * from finish();
rollback;
