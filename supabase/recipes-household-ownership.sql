-- Run this in the Supabase dashboard's SQL Editor.
--
-- Recipes move from user-owned (user_id, where null meant "global seed") to
-- household-owned (household_id + current_household_ids()), mirroring how
-- week_queue/pantry_state/pantry_items/shopping_items are already scoped.
-- Fixes a live bug: recipe-edit-all-and-source.sql let ANY authenticated
-- user mutate a shared seed row for every household. Also adds a public
-- recipe pool any household can search and import a copy of.

-- 1. Reserved system household that owns shared library content (target of
-- future scripts/seed.mjs runs). Fixed id so app code, the seed script, and
-- this migration all agree on it across environments/re-seeds.
insert into public.households (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Recipe Library')
on conflict (id) do nothing;

-- 2. New columns.
alter table public.recipes add column household_id uuid references public.households (id) on delete cascade;
alter table public.recipes add column is_public boolean not null default true;
alter table public.recipes add column imported_from_recipe_id uuid references public.recipes (id) on delete set null;

-- 3. user_id was already vestigial for ownership; rename it to reflect what
-- it still means going forward — who authored/generated the row, for
-- attribution only, never checked by RLS.
alter table public.recipes rename column user_id to created_by;

-- 4. Backfill: today's 41 rows are Britt's live, daily-used cookbook
-- (Madruga House is the only household with real members) — this is a
-- re-parent, not a content replacement (that's scripts/seed.mjs, see below).
update public.recipes r
set household_id = hm.household_id
from public.household_members hm
join auth.users u on u.id = hm.user_id
where r.household_id is null
  and u.email = 'brittany.madruga@gmail.com';

-- Defensive fallback so the NOT NULL below can never fail on a fresh env.
update public.recipes
set household_id = '00000000-0000-0000-0000-000000000001'
where household_id is null;

alter table public.recipes alter column household_id set not null;

-- 5. RLS rewrite. Supersedes recipes_select/_update/_delete from
-- auth-and-ratings.sql, recipes-household-visibility.sql, and
-- recipe-edit-all-and-source.sql — household_id now carries the sharing
-- that recipes-household-visibility.sql previously derived via a
-- household_members subquery.
drop policy if exists "recipes_select" on public.recipes;
drop policy if exists "recipes_insert" on public.recipes;
drop policy if exists "recipes_update" on public.recipes;
drop policy if exists "recipes_delete" on public.recipes;

create policy "recipes_select"
  on public.recipes for select
  to authenticated
  using (
    is_public = true
    or household_id in (select public.current_household_ids())
  );

create policy "recipes_insert"
  on public.recipes for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "recipes_update"
  on public.recipes for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy "recipes_delete"
  on public.recipes for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));
