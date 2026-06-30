-- Run this in the Supabase dashboard's SQL Editor.
-- Covers: letting Britt edit ANY recipe (including seed library recipes,
-- not just her own additions), plus an optional `source` link field.

-- 1. Broaden recipes_update to match recipes_select: seed recipes
-- (user_id is null) are shared library content, and the household curator
-- should be able to tinker with them just like her own additions. This does
-- NOT touch recipes_delete, which stays owner-only.
drop policy if exists "recipes_update" on public.recipes;

create policy "recipes_update"
  on public.recipes for update
  to authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

-- 2. Optional source link (URL or citation), settable by manual entry or AI
-- generation when a recipe is drawn from somewhere else.
alter table public.recipes add column source text;
