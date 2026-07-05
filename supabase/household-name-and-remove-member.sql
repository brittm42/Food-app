-- Run this in the Supabase dashboard's SQL Editor.
-- Adds two owner-only actions that had no RLS policy at all yet:
-- renaming the household, and removing a member. Neither `households` nor
-- `household_members` had an UPDATE/DELETE policy before this (only
-- select/insert), so both actions would silently fail (0 rows affected)
-- without this.
--
-- Uses a new SECURITY DEFINER helper, current_household_role(), the same
-- pattern households-rls-fix.sql used for current_household_ids() — a
-- policy on household_members can't subquery household_members directly
-- (infinite recursion, error 42P17), so the "am I the owner of this
-- household" check has to happen inside a function that bypasses RLS.

create or replace function public.current_household_role(target_household_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.household_members
  where user_id = auth.uid() and household_id = target_household_id;
$$;

create policy "households_update"
  on public.households for update
  to authenticated
  using (public.current_household_role(id) = 'owner')
  with check (public.current_household_role(id) = 'owner');

-- Members can only be removed by the household's owner, and only
-- non-owner rows (the app additionally prevents an owner from removing
-- themselves, but this is real defense-in-depth, not just a UI guard).
create policy "household_members_delete"
  on public.household_members for delete
  to authenticated
  using (
    role = 'member'
    and public.current_household_role(household_id) = 'owner'
  );
