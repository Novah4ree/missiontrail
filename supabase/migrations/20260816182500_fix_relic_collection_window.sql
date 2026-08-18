begin;

-- ============================================================
-- FIX 1
-- Record when a verified relic hunt reaches REVEALED.
--
-- Collection security already expects verification_started_at,
-- but the reveal transition was not filling it in.
-- ============================================================

create or replace function private.mark_relic_verification_started()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'revealed'
     and old.status is distinct from 'revealed'
     and new.verification_started_at is null then

    new.verification_started_at :=
      least(
        clock_timestamp(),
        new.expires_at - interval '1 millisecond'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists mark_relic_verification_started
on private.user_relic_assignments;

create trigger mark_relic_verification_started
before update of status
on private.user_relic_assignments
for each row
execute function private.mark_relic_verification_started();


-- ============================================================
-- FIX 2
-- Once the server issues a valid collection challenge,
-- keep the revealed assignment collectible for at least
-- the lifetime of that challenge.
--
-- This prevents:
--
-- FOUND
-- -> challenge issued
-- -> spawn window ticks over
-- -> Collect says "relic moved"
--
-- The player STILL needs:
--   * verified reveal
--   * valid one-time challenge
--   * fresh collection GPS samples
--   * server proximity verification
-- ============================================================

create or replace function private.sync_relic_collection_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.purpose = 'collection'
     and new.status = 'issued' then

    update private.user_relic_assignments as assignment
    set
      verification_started_at =
        coalesce(
          assignment.verification_started_at,
          least(
            clock_timestamp(),
            assignment.expires_at - interval '1 millisecond'
          )
        ),

      grace_ends_at =
        greatest(
          coalesce(assignment.grace_ends_at, new.expires_at),
          new.expires_at
        ),

      updated_at = clock_timestamp()

    where assignment.id = new.assignment_id
      and assignment.user_id = new.user_id
      and assignment.status = 'revealed';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_relic_collection_window
on private.one_time_collection_challenges;

create trigger sync_relic_collection_window
after insert or update of status, expires_at
on private.one_time_collection_challenges
for each row
execute function private.sync_relic_collection_window();


-- ============================================================
-- FIX 3
-- Repair any CURRENT revealed hunt that still has a live
-- collection challenge, so testing can continue immediately.
-- ============================================================

with current_challenge as (
  select distinct on (challenge.user_id, challenge.assignment_id)
    challenge.user_id,
    challenge.assignment_id,
    challenge.expires_at
  from private.one_time_collection_challenges as challenge
  where challenge.purpose = 'collection'
    and challenge.status = 'issued'
    and challenge.expires_at > clock_timestamp()
  order by
    challenge.user_id,
    challenge.assignment_id,
    challenge.expires_at desc
)
update private.user_relic_assignments as assignment
set
  verification_started_at =
    coalesce(
      assignment.verification_started_at,
      least(
        clock_timestamp(),
        assignment.expires_at - interval '1 millisecond'
      )
    ),

  grace_ends_at =
    greatest(
      coalesce(
        assignment.grace_ends_at,
        current_challenge.expires_at
      ),
      current_challenge.expires_at
    ),

  updated_at = clock_timestamp()

from current_challenge

where assignment.id = current_challenge.assignment_id
  and assignment.user_id = current_challenge.user_id
  and assignment.status = 'revealed';


commit;
