-- Run this in the Supabase dashboard's SQL Editor once auth is enabled.
-- Covers: locking down `recipes` with RLS, and creating the `ratings` table
-- from the PRD's data model (Feature 2: Thumbs Up / Down Rating).

-- 1. Lock down recipes.
-- Today this table has no RLS, so the publishable key (which ships in the
-- client JS bundle and isn't really secret) can read/write every row from
-- anywhere. These policies make that the actual security boundary, not just
-- the login screen in front of it.
alter table public.recipes enable row level security;

-- Seed recipes (user_id is null) are shared library content, readable by
-- any signed-in user. A user's own added recipes are private to them —
-- this is what keeps the data "user-scoped" for when Jason gets a login.
create policy "recipes_select"
  on public.recipes for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "recipes_insert"
  on public.recipes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "recipes_update"
  on public.recipes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recipes_delete"
  on public.recipes for delete
  to authenticated
  using (user_id = auth.uid());

-- 2. Ratings table.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.ratings enable row level security;

create policy "ratings_select"
  on public.ratings for select
  to authenticated
  using (user_id = auth.uid());

create policy "ratings_insert"
  on public.ratings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "ratings_update"
  on public.ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ratings_delete"
  on public.ratings for delete
  to authenticated
  using (user_id = auth.uid());
