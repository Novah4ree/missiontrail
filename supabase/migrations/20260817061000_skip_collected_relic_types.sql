begin;

-- =====================================================
-- DO NOT OFFER RELIC TYPES THE PLAYER ALREADY OWNS
-- =====================================================
--
-- Spawn candidates may contain duplicate relic types globally.
-- However, a player should not receive a relic type they have
-- already collected.
--
-- Example:
--
-- Fossil Fang candidate A
-- Fossil Fang candidate B
--
-- Player collects Fossil Fang A.
-- Fossil Fang B remains available to OTHER players,
-- but is hidden from this player.

drop function if exists public.server_list_spawn_candidates(uuid, uuid);

create function public.server_list_spawn_candidates(
  p_user_id uuid,
  p_spawn_window_id uuid
)
returns table (
  candidate_id uuid,
  slot_index integer,
  relic_id text,
  rarity text,
  latitude double precision,
  longitude double precision,
  safety_status text,
  spawn_tier text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    candidate.id,
    candidate.slot_index,
    candidate.relic_id,
    candidate.rarity,
    extensions.st_y(candidate.exact_point::extensions.geometry),
    extensions.st_x(candidate.exact_point::extensions.geometry),
    candidate.safety_status,
    candidate.spawn_tier
  from private.relic_spawn_candidates as candidate
  where candidate.spawn_window_id = p_spawn_window_id
    and candidate.status = 'available'

    and (
      candidate.owner_user_id is null
      or candidate.owner_user_id = p_user_id
    )

    -- Never return this exact spawn after it was collected.
    and not exists (
      select 1
      from private.user_relic_assignments as assignment
      where assignment.user_id = p_user_id
        and assignment.spawn_candidate_id = candidate.id
        and assignment.status = 'collected'
    )

    -- NEW:
    -- Never offer ANY candidate containing a relic type
    -- this player has already collected.
    and not exists (
      select 1
      from public.user_relic_collections as collection
      where collection.user_id = p_user_id
        and collection.relic_id = candidate.relic_id
    )

  order by candidate.slot_index;
$$;

revoke all on function public.server_list_spawn_candidates(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.server_list_spawn_candidates(uuid, uuid)
  to service_role;

comment on function public.server_list_spawn_candidates(uuid, uuid) is
  'Lists spawn candidates while excluding exact collected spawns and relic types already owned by this user.';

commit;
