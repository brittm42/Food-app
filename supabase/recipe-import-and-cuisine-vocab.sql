-- Run this in the Supabase dashboard's SQL Editor. Covers: recipe import
-- via URL (link-parsing, AI-extraction fallback), granular prep/cook time,
-- and converting cuisines from a hardcoded enum into an open, user-
-- extensible vocabulary (same pattern as tag_colors).

-- 1. Separate cook time from prep time.
alter table public.recipes add column cook_time_minutes integer;

-- 2. Import provenance — distinct from is_ai_generated, since an imported
-- recipe came from a real source (schema.org data or a scraped page), not
-- an AI-invented draft, even when AI helped extract it.
alter table public.recipes add column imported_via text
  check (imported_via in ('link', 'photo'));

-- 3. Cuisine vocabulary table, identical shape/RLS to tag_colors — adding a
-- cuisine no longer requires a code change/redeploy.
create table public.cuisine_colors (
  name text primary key,
  color text not null, -- one of: teal | coral | gold | plum | sage | red
  created_at timestamptz not null default now()
);

alter table public.cuisine_colors enable row level security;

create policy "cuisine_colors_select"
  on public.cuisine_colors for select
  to authenticated
  using (true);

create policy "cuisine_colors_insert"
  on public.cuisine_colors for insert
  to authenticated
  with check (true);

-- Seed with the 14 cuisines previously hardcoded in lib/types.ts's
-- CUISINE_LABELS, using their full display names as the canonical value
-- going forward (not the old short ids like "med"/"mex").
insert into public.cuisine_colors (name, color) values
  ('Mediterranean', 'teal'),
  ('Mexican', 'coral'),
  ('Asian', 'gold'),
  ('Indian', 'plum'),
  ('Italian', 'sage'),
  ('Thai', 'coral'),
  ('Chinese', 'red'),
  ('Japanese', 'plum'),
  ('Korean', 'sage'),
  ('Vietnamese', 'teal'),
  ('Middle Eastern', 'gold'),
  ('Greek', 'teal'),
  ('French', 'plum'),
  ('American', 'coral');

-- 4. One-time data conversion: rewrite existing short-id cuisine values to
-- their full labels in both places cuisines are stored, so old data lines
-- up with the new canonical (label-based) values going forward.
create or replace function public._cuisine_id_to_label(id text) returns text as $$
  select case id
    when 'med' then 'Mediterranean'
    when 'mex' then 'Mexican'
    when 'asi' then 'Asian'
    when 'ind' then 'Indian'
    when 'ita' then 'Italian'
    when 'tha' then 'Thai'
    when 'chn' then 'Chinese'
    when 'jpn' then 'Japanese'
    when 'kor' then 'Korean'
    when 'viet' then 'Vietnamese'
    when 'mideast' then 'Middle Eastern'
    when 'gre' then 'Greek'
    when 'fre' then 'French'
    when 'amr' then 'American'
    else id
  end;
$$ language sql immutable;

update public.recipes
set cuisines = (select array_agg(public._cuisine_id_to_label(c)) from unnest(cuisines) as c)
where cuisines is not null and array_length(cuisines, 1) > 0;

update public.profiles
set cuisine_preferences = (select array_agg(public._cuisine_id_to_label(c)) from unnest(cuisine_preferences) as c)
where cuisine_preferences is not null and array_length(cuisine_preferences, 1) > 0;

drop function public._cuisine_id_to_label(text);
