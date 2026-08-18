begin;

-- The former "immediate" implementation created a shared mathematical point.
-- Do not offer those candidates to new assignments after Ambient becomes
-- user-owned. Existing verification/reveal assignments keep working through the
-- normal grace path because proximity checks do not require candidate status to
-- remain available.
update private.relic_spawn_candidates
set status = 'expired', updated_at = clock_timestamp()
where spawn_tier = 'ambient'
  and owner_user_id is null
  and status = 'available';

commit;
