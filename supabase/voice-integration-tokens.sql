-- Voice quick-add to the Shopping List, Phase 1 (Siri/Shortcuts backend).
-- Each person's device (an iOS Shortcut today, an Alexa skill later) gets
-- its own revocable token resolving to a household, rather than one shared
-- secret. Same no-client-RLS pattern as household_invites (see
-- households.sql): the caller isn't an authenticated Supabase session, so
-- every read/write goes through the service-role admin client
-- (lib/supabase/admin.ts) instead of RLS policies.
create table public.voice_integration_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.voice_integration_tokens enable row level security;
-- No policies: only ever accessed via the service-role admin client.
