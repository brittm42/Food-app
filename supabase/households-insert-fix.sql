-- Run this in the Supabase dashboard's SQL Editor.
-- Fixes a drift between this repo's tracked policy (households.sql:71-74,
-- "with check (true)" — any authenticated user can create a household) and
-- what's actually enforced live: a real insert with a valid authenticated
-- JWT was rejected with "new row violates row-level security policy for
-- table households" (confirmed directly against the REST API, bypassing
-- the app entirely). Re-asserting the policy here regardless of whatever
-- is currently live restores the originally-documented, intended behavior.
-- This is required for the new auto-create-personal-household-on-first-
-- sign-in flow (lib/supabase/proxy.ts) to work at all.
drop policy if exists "households_insert" on public.households;

create policy "households_insert"
  on public.households for insert
  to authenticated
  with check (true);
