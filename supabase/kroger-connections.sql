-- Run this in the Supabase dashboard's SQL Editor.
--
-- One Kroger OAuth connection per household (the Madruga household shares a
-- single King Soopers login for fuel points, and that's the general model —
-- not "each person connects their own account"). Tokens are encrypted at
-- rest (see lib/crypto/secrets.ts) before being written here; this table
-- only ever stores ciphertext.
--
-- Same no-client-RLS pattern as household_invites/voice_integration_tokens:
-- there's no case where an authenticated user's own session should read or
-- write this table directly, so every access goes through the service-role
-- admin client (lib/supabase/admin.ts) instead of RLS policies.

create table public.kroger_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  expires_at timestamptz not null,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kroger_connections enable row level security;
-- No policies: only ever accessed via the service-role admin client.
