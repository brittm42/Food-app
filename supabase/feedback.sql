-- Run this in the Supabase dashboard's SQL Editor.
--
-- A simple in-app feedback form (account page -> /account/feedback). Same
-- no-client-RLS pattern as household_invites/alexa_linked_accounts: every
-- access goes through the service-role admin client (app/actions/feedback.ts
-- checks auth.getUser() itself before inserting), not RLS policies -- Britt
-- reviews submissions directly in the Supabase dashboard/SQL editor.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  category text not null default 'other' check (category in ('bug', 'idea', 'other')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- No policies: only ever accessed via the service-role admin client.
