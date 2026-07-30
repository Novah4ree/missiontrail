begin;

-- Lifetime XP is readable only through trusted server code. The client still
-- cannot insert ledger entries or choose its own reward amount.
create or replace function public.server_get_total_xp(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(ledger.xp_delta), 0)::bigint
  from private.xp_ledger as ledger
  where ledger.user_id = p_user_id;
$$;

revoke all on function public.server_get_total_xp(uuid) from public, anon, authenticated;
grant execute on function public.server_get_total_xp(uuid) to service_role;

commit;
