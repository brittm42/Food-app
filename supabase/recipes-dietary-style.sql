-- Run this in the Supabase dashboard's SQL Editor.
--
-- Phase B of the onboarding-wizard initiative. Adds dietary_style as real
-- recipe metadata (mirrors how `cuisines` already works) — today it only
-- exists as a *person's* stated preference (profiles.dietary_style), never
-- as a recipe classification. Backfilling the 41 existing seed recipes and
-- generating new ones to fill meal-type x dietary-style gaps happens via
-- scripts/backfill-recipe-dietary-style.mjs + apply-recipe-dietary-style.mjs
-- and scripts/generate-library-gap-recipes.mjs + apply-library-gap-recipes.mjs,
-- run after this migration.

alter table public.recipes add column if not exists dietary_style text[] not null default '{}';
