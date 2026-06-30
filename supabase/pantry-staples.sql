-- Run this in the Supabase dashboard's SQL Editor.
-- Adds the `pantry_staples` table: user-added always-stock items that
-- aren't tied to any recipe (e.g. Nutella, pretzel sticks). Unlike
-- CORE_PANTRY/WEEKLY_FRESH (static config in lib/types.ts), the item list
-- itself is per-user data, not just the checked state. Checked state still
-- lives in the existing `pantry_state` table, keyed by
-- `pantry:staple:<id>` (Pantry tab) and `shopping:staple:<id>` (Shopping
-- tab) — same two-namespace pattern WEEKLY_FRESH already uses.

create table public.pantry_staples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.pantry_staples enable row level security;

create policy "pantry_staples_select"
  on public.pantry_staples for select
  to authenticated
  using (user_id = auth.uid());

create policy "pantry_staples_insert"
  on public.pantry_staples for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "pantry_staples_delete"
  on public.pantry_staples for delete
  to authenticated
  using (user_id = auth.uid());
