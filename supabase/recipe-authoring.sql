-- Run this in the Supabase dashboard's SQL Editor for Feature 7 (Add/Edit
-- Recipe + AI-assisted generation). Covers: multi-cuisine, servings,
-- AI-authorship marker, and a shared tag-color vocabulary.

-- 1. Multi-cuisine: replace `cuisine` (text) with `cuisines` (text[]).
alter table public.recipes add column cuisines text[] not null default '{}';
update public.recipes set cuisines = array[cuisine] where cuisine is not null;
alter table public.recipes drop column cuisine;

-- 2. Servings (new field).
alter table public.recipes add column servings integer;

-- 3. AI-authorship marker, for the browse-view badge.
alter table public.recipes add column is_ai_generated boolean not null default false;

-- 4. Tag color vocabulary — shared across recipes (not user-scoped; tags
-- describe shared recipe vocabulary, same spirit as seed recipes being
-- readable by any signed-in user).
create table public.tag_colors (
  name text primary key,
  color text not null, -- one of the design-token keys: teal | coral | gold | plum | sage | red
  created_at timestamptz not null default now()
);

alter table public.tag_colors enable row level security;

create policy "tag_colors_select"
  on public.tag_colors for select
  to authenticated
  using (true);

create policy "tag_colors_insert"
  on public.tag_colors for insert
  to authenticated
  with check (true);

-- Seed the 5 colors already hardcoded in RecipeCard.tsx today, so existing
-- tags keep their current look after the move to DB-driven colors.
insert into public.tag_colors (name, color) values
  ('High protein', 'teal'),
  ('High fiber', 'teal'),
  ('No-cook', 'gold'),
  ('Batch cook', 'plum'),
  ('Britt only', 'coral');
