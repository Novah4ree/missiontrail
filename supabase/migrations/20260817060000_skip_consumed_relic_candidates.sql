begin;

-- =====================================================
-- DO NOT REUSE AN ALREADY-COLLECTED SPAWN FOR A USER
-- =====================================================
--
-- A relic TYPE may appear many times:
--
-- Fossil Fang candidate A -> collectible
-- Fossil Fang candidate B -> collectible
-- Fossil Fang candidate C -> collectible
--
-- But candidate A must never be handed back to the same
-- player after its assignment was collected.

drop function if exists public.server_list_spawn_candidates(uuid, uuid);

create or replace function public.server_list_spawn_candidates(
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

    -- IMPORTANT:
    -- Never offer the same physical/server spawn again once
    -- this user has already collected its assignment.
    and not exists (
      select 1
      from private.user_relic_assignments as assignment
      where assignment.user_id = p_user_id
        and assignment.spawn_candidate_id = candidate.id
        and assignment.status = 'collected'
    )

  order by candidate.slot_index;
$$;

revoke all on function public.server_list_spawn_candidates(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.server_list_spawn_candidates(uuid, uuid)
  to service_role;

comment on function public.server_list_spawn_candidates(uuid, uuid) is
  'Lists available spawn candidates while excluding candidates already collected by this user. Different candidates may contain the same relic type.';

commit;
