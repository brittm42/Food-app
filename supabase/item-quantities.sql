-- Run this in the Supabase dashboard's SQL Editor.
--
-- Adds a purely decorative, free-text `quantity` column to one-off Shopping
-- List items and Staples (e.g. "2 rolls", "family size") — NOT the same as
-- Ingredient.quantity_value/quantity_unit used for pantry reconciliation
-- (supabase/pantry-on-hand.sql). Neither of these tables is tied to a
-- recipe or a computed "need," so there's nothing to reconcile against —
-- this is just a note shown next to the item.

alter table public.shopping_items add column if not exists quantity text;
alter table public.pantry_staples add column if not exists quantity text;
