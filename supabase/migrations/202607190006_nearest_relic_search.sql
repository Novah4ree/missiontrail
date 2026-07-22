begin;

-- The Expo app cannot call this helper. It gives the relic-proximity Edge
-- Function the private points it needs to find the closest active relic while
-- keeping every exact coordinate out of client-visible database responses.
create or replace function public.server_list_nearby_relic_contexts(p_user_id uuid)
returns table (
  assignment_id uuid,
  exact_latitude double precision,
  exact_longitude double precision
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_rare_eligible boolean;
  v_legendary_eligible boolean;
begin
  select eligibility.rare_eligible, eligibility.legendary_eligible
  into v_rare_eligible, v_legendary_eligible
  from public.server_get_daily_eligibility(p_user_id) as eligibility;

  return query
  select
    assignment.id,
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry)
  from private.user_relic_assignments as assignment
  join private.relic_spawn_candidates as candidate
    on candidate.id = assignment.spawn_candidate_id
  where assignment.user_id = p_user_id
    and assignment.status in ('active', 'verification', 'revealed')
    and private.assignment_is_active(
      assignment.expires_at,
      assignment.grace_ends_at,
      assignment.verification_started_at,
      clock_timestamp()
    )
    and case
      when assignment.rarity = 'rare' then v_rare_eligible
      when assignment.rarity = 'legendary' then v_legendary_eligible
      else true
    end
    and not exists (
      select 1
      from public.user_relic_collections as collection
      where collection.user_id = p_user_id
        and collection.assignment_id = assignment.id
    );
end;
$$;

revoke all on function public.server_list_nearby_relic_contexts(uuid)
  from public, anon, authenticated;
grant execute on function public.server_list_nearby_relic_contexts(uuid)
  to service_role;

comment on function public.server_list_nearby_relic_contexts(uuid) is
  'Service-only exact points used to choose the nearest relic. Never call or expose this function from the Expo client.';

-- Keep the player-facing names aligned with the artwork registry while
-- preserving the stable IDs already used by saved Vault collections.
update public.relic_catalog
set display_name = case relic_id
  when 'phoenix-ember-crystal' then 'Phoenix Ember'
  when 'premium-siren-shell' then 'Premium Siren Shell'
  when 'comic-egg' then 'Cosmic Egg'
  else display_name
end
where relic_id in ('phoenix-ember-crystal', 'premium-siren-shell', 'comic-egg');

commit;
