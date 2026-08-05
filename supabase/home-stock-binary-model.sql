-- Run this in the Supabase dashboard's SQL Editor.
--
-- Retires precise numeric on-hand tracking for Pantry-category items in
-- favor of the same binary in-stock/need-to-buy model Fresh items already
-- use (Britt's call: she won't maintain per-item quantity counts day to
-- day — just wants a checklist to eyeball and a one-tap restock). Recipe
-- reconciliation moves from `pantry_on_hand` (a separate, drift-prone
-- on-hand tracker keyed by ingredient name, kept in sync with pantry_items
-- only by convention) to matching directly against the household's own
-- pantry_items catalog by name — see lib/shopping.ts's rewritten
-- getShoppingListData/computeWeeklyPantryNeeds/syncWeeklyNeedsToShoppingList.
--
-- Also adds the new Household top-level Home Stock tab's aisle categories
-- (lib/categories.ts), and a `recipe_driven` flag so a Shopping List item
-- auto-added because this week's queued recipes need it — and it isn't
-- something normally stocked — can be shown with a distinct visual
-- indicator from a regular restock/one-off add.

-- Remap the old catch-all "Household & Non-food" category to the new
-- granular default before the code stops recognizing the old string.
update public.pantry_items set category = 'Other Household' where category = 'Household & Non-food';
update public.shopping_items set category = 'Other Household' where category = 'Household & Non-food';

-- Pantry-category items no longer track a numeric on-hand quantity —
-- `in_stock` (already added for Fresh items) now drives both.
alter table public.pantry_items drop column if exists on_hand_qty;
alter table public.pantry_items drop column if exists on_hand_unit;

-- No longer needed — the household's own pantry_items catalog (by name +
-- in_stock) is now the single source of truth for "do I have this."
drop table if exists public.pantry_on_hand;

alter table public.shopping_items add column if not exists recipe_driven boolean not null default false;

-- Stale toggle state from the retired "Check Core Pantry" checklist
-- (item_key like 'shopping:core:%') — harmless to leave, but no longer
-- read by any code path, so clean it up rather than let it linger.
delete from public.pantry_state where item_key like 'shopping:core:%';
