-- Run this in the Supabase dashboard's SQL Editor.
-- Two new household-scoped tables for the Shopping/Pantry UX overhaul:
--
-- 1. `shopping_items` — one-off ad-hoc items added straight from the
--    Shopping List (e.g. "paper towels"). Deliberately NOT the same as
--    `pantry_staples` (a permanent, always-relevant list) — a one-off item
--    is meant to disappear the moment it's checked off, so there's no
--    `checked` column at all; the app just deletes the row.
--
-- 2. `pantry_catalog_removed` — lets a household permanently remove a
--    static Core Pantry / Weekly Fresh catalog item (e.g. "we'll never
--    keep Farro on hand") without touching the shared `CORE_PANTRY`/
--    `WEEKLY_FRESH` config in lib/types.ts, and restore it later. A row's
--    existence means "hidden from this household's Pantry/Shopping views."

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  is_food boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.shopping_items enable row level security;

create policy "shopping_items_select"
  on public.shopping_items for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "shopping_items_insert"
  on public.shopping_items for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "shopping_items_delete"
  on public.shopping_items for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));

create table public.pantry_catalog_removed (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null,
  removed_at timestamptz not null default now(),
  unique (household_id, item_key)
);

alter table public.pantry_catalog_removed enable row level security;

create policy "pantry_catalog_removed_select"
  on public.pantry_catalog_removed for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "pantry_catalog_removed_insert"
  on public.pantry_catalog_removed for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_catalog_removed_delete"
  on public.pantry_catalog_removed for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));
