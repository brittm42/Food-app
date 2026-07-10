-- Run this in the Supabase dashboard's SQL Editor.
--
-- Cleanup pass for the Shopping List/Pantry redesign, once
-- pantry-items-and-categories.sql has been applied and
-- scripts/seed-pantry-items.mjs has migrated every household's data into
-- `pantry_items`. Drops what's now fully superseded and confirmed unused
-- in the app code:
--   - `shopping_items.is_food` — replaced by automatic categorization
--     (the Food/Non-food toggle is gone from the UI).
--   - `shopping_items.quantity` — the old free-text quantity note,
--     replaced by structured quantity_value/quantity_unit.
--   - `pantry_staples` — fully replaced by `pantry_items` (item_type =
--     'staple'); every row was migrated by the seed script.
--   - `pantry_catalog_removed` — the old "hide a static catalog item"
--     override table. Core Pantry/Weekly Fresh are real, deletable
--     `pantry_items` rows now, so there's nothing left to hide.

alter table public.shopping_items drop column if exists is_food;
alter table public.shopping_items drop column if exists quantity;

drop table if exists public.pantry_staples;
drop table if exists public.pantry_catalog_removed;
