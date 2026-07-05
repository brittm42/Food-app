-- Run this in the Supabase dashboard's SQL Editor. Covers: Recipe card
-- content upgrade — structured ingredient quantities/units, ordered
-- step-by-step instructions (replacing prose), and a prep-time field.

-- 1. Ordered instruction steps. text[] to match the existing precedent for
-- flat string-array columns (cuisines, tags). Each element may contain
-- inline <strong> HTML, same convention as the legacy `recipe` prose field.
alter table public.recipes add column steps text[] not null default '{}';

-- 2. Prep time (minutes). No separate cook-time field per product decision.
alter table public.recipes add column prep_time_minutes integer;

-- 3. Legacy prose instructions: kept non-destructively (existing seed rows
-- have real content here, and it's used as backfill-script input), but no
-- longer required or rendered by the app going forward. `steps` is now the
-- source of truth for the "How to make it" UI.
alter table public.recipes alter column recipe drop not null;

-- 4. `ingredients` (jsonb) is unchanged at the DB level — jsonb is
-- schemaless, so adding `quantity`/`unit` keys to each ingredient object is
-- purely an application-level type change (see lib/types.ts). Existing rows
-- simply won't have those keys until backfilled or edited.
