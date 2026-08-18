begin;

-- The mystery-zone list and nearest-relic search must use the same
-- server-authored eligibility snapshot. Re-evaluating today's Rare/Legendary
-- progress here can disagree with an assignment that was already classified
-- as available for its active spawn window.
drop function if exists public.server_list_nearby_relic_contexts(uuid);

create function public.server_list_nearby_relic_contexts(p_user_id uuid)
returns table (
  assignment_id uuid,
  assignment_status text,
  eligibility_status text,
  exact_latitude double precision,
  exact_longitude double precision
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    assignment.id,
    assignment.status,
    assignment.eligibility_status,
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry)
  from private.user_relic_assignments as assignment
  join private.relic_spawn_candidates as candidate
    on candidate.id = assignment.spawn_candidate_id
  where assignment.user_id = p_user_id
    and assignment.status in ('active', 'verification', 'revealed')
    and assignment.eligibility_status in ('eligible', 'overridden')
    and private.assignment_is_active(
      assignment.expires_at,
      assignment.grace_ends_at,
      assignment.verification_started_at,
      clock_timestamp()
    )
    and not exists (
      select 1
      from public.user_relic_collections as collection
      where collection.user_id = p_user_id
        and collection.assignment_id = assignment.id
    );
$$;

revoke all on function public.server_list_nearby_relic_contexts(uuid)
  from public, anon, authenticated;
grant execute on function public.server_list_nearby_relic_contexts(uuid)
  to service_role;

comment on function public.server_list_nearby_relic_contexts(uuid) is
  'Service-only active available assignment contexts for nearest-relic navigation. Exact points must never be exposed to the Expo client.';

commit;
