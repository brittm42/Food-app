-- Run this in the Supabase dashboard's SQL Editor.
--
-- Adds a `note` column to `pantry_items`, carrying over what the old
-- WEEKLY_FRESH config's per-item `note` field held (e.g. "Britt only",
-- "family protein") — missed by the initial pantry-items-and-categories.sql
-- migration, since pantry_items had nowhere to put it. Purely additive.

alter table public.pantry_items add column if not exists note text;
