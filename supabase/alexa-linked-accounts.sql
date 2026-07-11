-- Run this in the Supabase dashboard's SQL Editor.
--
-- Maps a household to whichever Amazon email its Echo devices actually use
-- (the Madruga household's Echos are all on Jason's Amazon login — same
-- shared-login model as kroger_connections, not "each person connects
-- their own account"). Alexa's own account-linking (Login with Amazon)
-- already verifies that email on Amazon's side per request
-- (context.System.user.accessToken -> https://api.amazon.com/user/profile);
-- this table just records which household that verified email belongs to.
-- Deliberately does not require a WeeklyNom login (auth.users row) for that
-- email — a household member (e.g. a dependent, or a device-only user like
-- Jason) can use voice add without ever signing into WeeklyNom themselves.
--
-- Same no-client-RLS pattern as kroger_connections/household_invites/
-- voice_integration_tokens: every access goes through the service-role
-- admin client (lib/supabase/admin.ts) instead of RLS policies.

create table public.alexa_linked_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  linked_email text not null,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alexa_linked_accounts_email_idx on public.alexa_linked_accounts (lower(linked_email));

alter table public.alexa_linked_accounts enable row level security;
-- No policies: only ever accessed via the service-role admin client.
