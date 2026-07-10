-- Run this in the Supabase dashboard's SQL Editor.
--
-- Shopping List / Pantry redesign: real grocery-aisle categories on every
-- item, structured quantity+unit everywhere (replacing free-text notes),
-- and a unified `pantry_items` table that replaces the static CORE_PANTRY/
-- WEEKLY_FRESH catalogs in lib/types.ts plus the old `pantry_staples`
-- table — item names, categories, and quantities become real per-household
-- data instead of hardcoded config, so they can be renamed/recategorized/
-- retargeted without a code change.
--
-- item_type distinguishes three kinds of item:
--   'core'         — shelf-stable pantry staples tracked against this
--                    week's recipe needs (was CORE_PANTRY). on_hand_qty/
--                    unit here are the canonical display values for the
--                    Pantry tab; the existing `pantry_on_hand` table (keyed
--                    by normalized ingredient name) is left untouched and
--                    stays the source of truth for recipe-driven
--                    reconciliation in Shopping List's "Check Core Pantry"/
--                    "Other Core Ingredients" sections — the app writes
--                    on-hand edits to both, so the two never drift.
--   'weekly_fresh' — perishables bought fresh every week regardless of
--                    stock (was WEEKLY_FRESH). No on-hand concept.
--                    target_qty/unit here means "the usual amount to buy,"
--                    used as the default when tapped to add to the
--                    shopping list.
--   'staple'       — user-added always-stock items (was `pantry_staples`).
--                    target_qty/unit is a restock par level; tapping "+"
--                    adds (target - on_hand) to the shopping list.
--
-- Existing data (CORE_PANTRY/WEEKLY_FRESH config, `pantry_staples` rows,
-- `pantry_on_hand` on-hand values) is migrated into this table by a
-- one-off script (scripts/seed-pantry-items.mjs), not by this file.

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  category text not null,
  item_type text not null check (item_type in ('core', 'weekly_fresh', 'staple')),
  on_hand_qty numeric,
  on_hand_unit text,
  target_qty numeric,
  target_unit text,
  created_at timestamptz not null default now()
);

alter table public.pantry_items enable row level security;

create policy "pantry_items_select"
  on public.pantry_items for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "pantry_items_insert"
  on public.pantry_items for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_items_update"
  on public.pantry_items for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_items_delete"
  on public.pantry_items for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));

-- Shopping List: real category + structured quantity on every item
-- (replacing the free-text `quantity` note and the manual Food/Non-food
-- toggle — categorization is now automatic via lib/categorize.ts, and
-- non-food items just land in the "Household & Non-food" category).
-- `source_pantry_item_id` is set when a row was pushed here from Pantry's
-- restock/add-to-list action, so the UI can tell those apart from a
-- manually-typed one-off if it ever needs to (not used for logic today).
-- `is_food` and the old free-text `quantity` column are left in place for
-- now (app stops writing to them) so the migration script below still has
-- the old data to read from; a follow-up cleanup migration drops them once
-- the migration is verified.
alter table public.shopping_items add column if not exists category text not null default 'Other';
alter table public.shopping_items add column if not exists quantity_value numeric;
alter table public.shopping_items add column if not exists quantity_unit text;
alter table public.shopping_items add column if not exists source_pantry_item_id uuid references public.pantry_items (id) on delete set null;
alter table public.shopping_items alter column category drop default;
