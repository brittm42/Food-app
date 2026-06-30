-- Run this in the Supabase dashboard's SQL Editor.
-- Covers: Feature 8 (Overnight Oats "Pick 2") — persists which oat flavors
-- a user has picked for the week, across sessions and devices.

create table public.oat_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  flavor_id text not null,
  picked_at timestamptz not null default now(),
  unique (user_id, flavor_id)
);

alter table public.oat_picks enable row level security;

create policy "oat_picks_select"
  on public.oat_picks for select
  to authenticated
  using (user_id = auth.uid());

create policy "oat_picks_insert"
  on public.oat_picks for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "oat_picks_delete"
  on public.oat_picks for delete
  to authenticated
  using (user_id = auth.uid());
