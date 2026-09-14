begin;

create table if not exists private.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('account', 'privacy', 'purchase', 'unsafe_location', 'technical', 'other')),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.support_requests is
  'Private Mission Trails support tickets. Tickets are deleted with the user account unless separately retained under a documented legal/security requirement.';

create index if not exists support_requests_user_created_idx
  on private.support_requests (user_id, created_at desc);
create index if not exists support_requests_status_created_idx
  on private.support_requests (status, created_at);

revoke all on private.support_requests from public, anon, authenticated;
grant select, insert, update, delete on private.support_requests to service_role;

create or replace function public.server_create_support_request(
  p_user_id uuid,
  p_category text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_category not in ('account', 'privacy', 'purchase', 'unsafe_location', 'technical', 'other') then
    raise exception 'INVALID_CATEGORY';
  end if;

  if char_length(trim(coalesce(p_message, ''))) not between 10 and 4000 then
    raise exception 'INVALID_MESSAGE';
  end if;

  insert into private.support_requests (user_id, category, message)
  values (p_user_id, p_category, trim(p_message))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.server_create_support_request(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.server_create_support_request(uuid, text, text)
  to service_role;

commit;
