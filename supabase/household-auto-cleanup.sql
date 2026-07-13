-- Run this in the Supabase dashboard's SQL Editor.
--
-- Fixes the root cause behind 17 orphaned households found and manually
-- deleted on 2026-07-13: household_members.user_id already cascades away
-- when a throwaway test auth account is deleted (households.sql), but
-- nothing ever cleaned up the now-memberless household row itself. There's
-- no households_delete RLS policy at all (verified — no authenticated
-- session can delete a household directly), so this trigger runs as
-- security definer to do it on the household's behalf once its last member
-- is gone. That in turn cascades away any recipes/pantry_items/
-- shopping_items/week_queue/etc. the household owned (all already
-- `on delete cascade` from households.id).

create or replace function public.delete_household_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.household_members where household_id = old.household_id
  ) then
    delete from public.households where id = old.household_id;
  end if;
  return old;
end;
$$;

drop trigger if exists household_members_cleanup on public.household_members;

create trigger household_members_cleanup
  after delete on public.household_members
  for each row
  execute function public.delete_household_if_empty();
