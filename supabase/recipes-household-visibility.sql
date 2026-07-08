-- Run this in the Supabase dashboard's SQL Editor.
-- Fixes: household members other than the recipe's owner couldn't see that
-- recipe in the shared This Week queue or Shopping List. week_queue itself
-- has been household-scoped since households.sql, but recipes_select was
-- never broadened to match — a household mate's SELECT on someone else's
-- personal recipe still got denied, so the embedded `recipe:recipes(*)`
-- join in app/this-week/page.tsx (and the ingredients join in
-- app/shopping/page.tsx) silently came back null for that row.
--
-- This only touches recipes_select (visibility). recipes_update/_delete
-- deliberately stay owner-only, same reasoning as
-- recipe-edit-all-and-source.sql: seeing a household mate's recipe in a
-- shared queue shouldn't mean you can edit or delete it.
drop policy if exists "recipes_select" on public.recipes;

create policy "recipes_select"
  on public.recipes for select
  to authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or user_id in (
      select hm.user_id from public.household_members hm
      where hm.household_id in (select public.current_household_ids())
      and hm.user_id is not null
    )
  );
