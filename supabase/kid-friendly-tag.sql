-- Run this in the Supabase dashboard's SQL Editor.
-- Seeds the "Kid-friendly" tag so it's selectable from the existing
-- Add/Edit Recipe tag picker (components/RecipeForm.tsx) and the
-- Recipes tab's new "Kid-friendly only" filter has a real tag to match
-- against (RecipesBrowser.tsx filters by `tags.includes("Kid-friendly")`).

insert into public.tag_colors (name, color) values
  ('Kid-friendly', 'sage');
