-- Run this in the Supabase dashboard's SQL Editor.
--
-- Supports the Kitchen (formerly Pantry) redesign: a literal Fresh (Produce,
-- Dairy & Eggs, Meat & Seafood, Bakery) vs. Pantry (everything else,
-- including Frozen) split, derived purely from an item's existing
-- `category` column (see lib/categories.ts's FRESH_CATEGORIES) — no schema
-- change needed for the split itself.
--
-- Fresh-category pantry_items get a binary in-stock/need-it state instead
-- of numeric on-hand tracking (no one tracks "6 eggs left"). Pantry-category
-- items are unaffected — same on-hand/target tracking as before.
alter table public.pantry_items add column if not exists in_stock boolean not null default true;

-- Extends the existing freeform `note` (already on pantry_items, e.g.
-- "Britt only") to shopping_items too, so one-off Shopping List adds can
-- also carry a brand/store-preference note — feeds the future Kroger
-- integration's AI product matcher as context, not a structured field.
alter table public.shopping_items add column if not exists note text;

-- shopping_items has only ever needed select/insert/delete until now — the
-- new tap-to-edit sheet (quantity/unit/note) is its first UPDATE need, so
-- there's no update policy yet. Without this, updateShoppingItem's write is
-- silently blocked by RLS (0 rows affected, no thrown error) — the same
-- recurring gotcha hit before for households, week_queue, etc. whenever a
-- table gains its first UPDATE.
drop policy if exists "shopping_items_update" on public.shopping_items;
create policy "shopping_items_update"
  on public.shopping_items for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));
