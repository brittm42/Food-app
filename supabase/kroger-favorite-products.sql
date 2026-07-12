-- Run this in the Supabase dashboard's SQL Editor.
--
-- "Favorite" a Kroger product per ingredient, so the review screen
-- (KrogerReviewView.tsx) pre-selects the household's preferred brand/size
-- instead of Kroger's own top-search-relevance pick every time that
-- ingredient shows up. Household-scoped, not per-person (matches the
-- Kroger connection itself being shared, per kroger-connections.sql).
--
-- ingredient_name is stored pre-normalized (trimmed + lowercased) by the
-- app layer, same convention as pantry_on_hand.sql, so the plain-column
-- unique constraint below works with a native upsert.
--
-- description/brand are cached here (not just the upc) so a favorited
-- product can still be shown/pre-selected even if a fresh Products search
-- doesn't happen to return it among that day's top candidates (e.g. search
-- ranking shifts, or a smaller `limit` at some point in the future) —
-- lib/kroger/review.ts injects the favorite as a synthetic candidate using
-- these cached fields when it's missing from the live search results.

create table public.kroger_favorite_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_name text not null,
  upc text not null,
  description text not null,
  brand text,
  updated_at timestamptz not null default now(),
  unique (household_id, ingredient_name)
);

alter table public.kroger_favorite_products enable row level security;

create policy "kroger_favorite_products_select"
  on public.kroger_favorite_products for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "kroger_favorite_products_insert"
  on public.kroger_favorite_products for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

-- Primary write path is an upsert on the unique index above, so an UPDATE
-- policy is required — see the same gotcha documented in
-- pantry-on-hand.sql/week-queue-servings-override.sql (a table with only
-- select/insert/delete silently blocks UPDATEs under RLS: 0 rows affected,
-- no error).
create policy "kroger_favorite_products_update"
  on public.kroger_favorite_products for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy "kroger_favorite_products_delete"
  on public.kroger_favorite_products for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));
