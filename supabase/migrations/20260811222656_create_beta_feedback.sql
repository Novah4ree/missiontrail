-- ============================================
-- MISSION TRAILS
-- Beta Tester Feedback Table
-- ============================================


-- Create the beta_feedback table
create table public.beta_feedback (

  -- Every feedback report gets a unique ID
  id uuid primary key default gen_random_uuid(),

  -- Connect feedback to the signed-in Supabase user
  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- What kind of feedback the tester is sending
  category text not null
    check (
      category in (
        'Bug',
        'Idea',
        'Design',
        'Map/GPS',
        'Trail',
        'Relic',
        'Companion'
      )
    ),

  -- What the tester typed
  message text not null,

  -- Debugging information
  app_version text,
  device_type text,
  current_screen text,

  -- Automatically record when feedback was submitted
  created_at timestamptz not null default now()
);


-- ============================================
-- PERMISSIONS
-- ============================================

-- Allow signed-in users to read and submit feedback
grant select, insert
on table public.beta_feedback
to authenticated;


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.beta_feedback
enable row level security;


-- A user can only submit feedback connected
-- to their own account
create policy "Users can submit their own beta feedback"
on public.beta_feedback
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- A user can only read their own feedback
create policy "Users can read their own beta feedback"
on public.beta_feedback
for select
to authenticated
using (
  auth.uid() = user_id
);