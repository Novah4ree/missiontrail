-- ============================================================
-- MISSION TRAILS MEETUP SCHEDULE UPGRADE
-- ============================================================

-- Purpose:
-- Gives Meetups real start/end timestamps so expired Meetups
-- can be removed correctly instead of surviving until midnight.

alter table public.trail_meetups
add column if not exists starts_at timestamptz;

alter table public.trail_meetups
add column if not exists ends_at timestamptz;

alter table public.trail_meetups
add column if not exists description text;

alter table public.trail_meetups
add column if not exists meetup_type text
not null default 'community';

alter table public.trail_meetups
add column if not exists category text
not null default 'adventure';

alter table public.trail_meetups
add column if not exists landmark_name text;

alter table public.trail_meetups
add column if not exists latitude double precision;

alter table public.trail_meetups
add column if not exists longitude double precision;

alter table public.trail_meetups
add column if not exists is_verified boolean
not null default false;

alter table public.trail_meetups
add column if not exists is_cancelled boolean
not null default false;


-- ============================================================
-- VALIDATION
-- ============================================================

alter table public.trail_meetups
drop constraint if exists trail_meetups_type_check;

alter table public.trail_meetups
add constraint trail_meetups_type_check
check (
  meetup_type in (
    'official',
    'community',
    'friends'
  )
);


alter table public.trail_meetups
drop constraint if exists trail_meetups_category_check;

alter table public.trail_meetups
add constraint trail_meetups_category_check
check (
  category in (
    'adventure',
    'games',
    'shopping',
    'culture',
    'food',
    'fitness'
  )
);


alter table public.trail_meetups
drop constraint if exists trail_meetups_schedule_check;

alter table public.trail_meetups
add constraint trail_meetups_schedule_check
check (
  starts_at is null
  or
  ends_at is null
  or
  ends_at > starts_at
);


-- ============================================================
-- READ POLICY
-- ============================================================

drop policy if exists
"Verified adults can read trail meetups"
on public.trail_meetups;

create policy
"Verified adults can read trail meetups"
on public.trail_meetups
for select
to authenticated
using (
  public.mission_trails_can_use_meetups()

  and

  is_cancelled = false

  and

  (
    -- New Meetup records use real timestamps.
    ends_at > now()

    or

    -- Legacy Meetups remain readable until they are migrated.
    (
      ends_at is null
      and
      meetup_date >= current_date
    )
  )
);


-- ============================================================
-- CREATE POLICY
-- ============================================================

drop policy if exists
"Verified adults can create trail meetups"
on public.trail_meetups;

create policy
"Verified adults can create trail meetups"
on public.trail_meetups
for insert
to authenticated
with check (
  public.mission_trails_can_use_meetups()

  and

  host_user_id = auth.uid()

  and

  starts_at is not null

  and

  ends_at is not null

  and

  starts_at > now()

  and

  ends_at > starts_at

  and

  is_cancelled = false
);


-- ============================================================
-- JOIN REQUEST POLICY
-- ============================================================

drop policy if exists
"Verified adults can request meetup access"
on public.trail_meetup_join_requests;

create policy
"Verified adults can request meetup access"
on public.trail_meetup_join_requests
for insert
to authenticated
with check (
  public.mission_trails_can_use_meetups()

  and

  user_id = auth.uid()

  and

  status = 'requested'

  and

  exists (
    select 1
    from public.trail_meetups meetup
    where meetup.id = meetup_id

      and meetup.is_cancelled = false

      and meetup.ends_at > now()

      and meetup.attendee_count < meetup.max_group_size
  )
);


-- ============================================================
-- INDEX
-- ============================================================

create index if not exists
trail_meetups_starts_at_idx
on public.trail_meetups (starts_at);

create index if not exists
trail_meetups_ends_at_idx
on public.trail_meetups (ends_at);
