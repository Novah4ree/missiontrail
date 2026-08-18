-- Mission Trails user profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade default auth.uid(),

  username text,
  display_name text,
  bio text,
  avatar_url text,
  city text,
  state text,
  explorer_rank text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Make sure columns exist if this migration is ever run
-- against a partially-created profiles table.
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists explorer_rank text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can read own profile"
  on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or auth.uid() = user_id
);

drop policy if exists "Users can create own profile"
  on public.profiles;

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and (
    user_id is null
    or auth.uid() = user_id
  )
);

drop policy if exists "Users can update own profile"
  on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or auth.uid() = user_id
)
with check (
  auth.uid() = id
  or auth.uid() = user_id
);

create index if not exists profiles_user_id_idx
  on public.profiles(user_id);

create index if not exists profiles_username_idx
  on public.profiles(username);
