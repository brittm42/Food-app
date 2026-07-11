-- Run this in the Supabase dashboard's SQL Editor.
--
-- Adds "sent to Kroger" state directly onto shopping_items, so a Fresh/Pantry
-- checklist item (computed from this week's recipes, no row of its own
-- today) becomes a real, persistent row the moment it's sent — the same
-- move the existing Kitchen restock flow already makes
-- (addPantryItemToShoppingList/flagPantryItemNeeded in app/actions/pantry.ts),
-- just triggered by "Send to Kroger" instead of the "+"/flag actions.
--
-- source_checklist_key is distinct from the existing source_pantry_item_id:
-- source_pantry_item_id links back to a Kitchen catalog row (used by the
-- existing Fresh-restock reconciliation in removeShoppingItem); this new
-- column instead carries the original `shopping:core:<name>` /
-- `shopping:fresh:<name>` computed key, so "mark order picked up" can tell a
-- materialized Core item apart from a materialized Fresh item and run the
-- right on-hand reconciliation for each (see app/actions/kroger-send.ts).

alter table public.shopping_items add column if not exists sent_at timestamptz;
alter table public.shopping_items add column if not exists source_checklist_key text;
alter table public.shopping_items add column if not exists kroger_upc text;
alter table public.shopping_items add column if not exists kroger_product_description text;
alter table public.shopping_items add column if not exists kroger_quantity integer;
