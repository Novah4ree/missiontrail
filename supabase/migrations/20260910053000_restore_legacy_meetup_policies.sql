-- ============================================================
-- MISSION TRAILS MEETUP SAFE ROLLBACK
-- ============================================================
--
-- Purpose:
-- Restores the original Meetup policies from
-- 20260823022500_secure_trail_meetups.sql.
--
-- New columns are intentionally left in place for now so this
-- rollback does not destroy any Meetup data.


-- ============================================================
-- RESTORE ORIGINAL READ POLICY
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

  meetup_date >= current_date
);


-- ============================================================
-- RESTORE ORIGINAL CREATE POLICY
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

  meetup_date >= current_date
);


-- ============================================================
-- RESTORE ORIGINAL JOIN REQUEST POLICY
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
    where
      meetup.id = meetup_id

      and

      meetup.meetup_date >= current_date
  )
);
