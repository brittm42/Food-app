-- Run this in the Supabase dashboard's SQL Editor.
-- Fixes "infinite recursion detected in policy for relation
-- household_members" (Postgres error 42P17) from supabase/households.sql.
-- The original policies checked "is this row in one of my households" by
-- subquerying household_members from within a policy ON household_members
-- (and every table that also queries household_members), which re-triggers
-- the same RLS policy recursively. This creates a SECURITY DEFINER helper
-- function (owned by postgres, which has BYPASSRLS) so that lookup skips
-- RLS entirely instead of recursing, and repoints every affected policy at
-- it. No data changes — households.sql's tables and seeded rows are
-- untouched; only the policy definitions change.

create or replace function public.current_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

drop policy if exists "households_select" on public.households;
create policy "households_select"
  on public.households for select
  to authenticated
  using (id in (select public.current_household_ids()));

drop policy if exists "household_members_select" on public.household_members;
create policy "household_members_select"
  on public.household_members for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

drop policy if exists "week_queue_select" on public.week_queue;
drop policy if exists "week_queue_insert" on public.week_queue;
drop policy if exists "week_queue_delete" on public.week_queue;

create policy "week_queue_select"
  on public.week_queue for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "week_queue_insert"
  on public.week_queue for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "week_queue_delete"
  on public.week_queue for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));

drop policy if exists "pantry_state_select" on public.pantry_state;
drop policy if exists "pantry_state_insert" on public.pantry_state;
drop policy if exists "pantry_state_delete" on public.pantry_state;

create policy "pantry_state_select"
  on public.pantry_state for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "pantry_state_insert"
  on public.pantry_state for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_state_delete"
  on public.pantry_state for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));

drop policy if exists "pantry_staples_select" on public.pantry_staples;
drop policy if exists "pantry_staples_insert" on public.pantry_staples;
drop policy if exists "pantry_staples_delete" on public.pantry_staples;

create policy "pantry_staples_select"
  on public.pantry_staples for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "pantry_staples_insert"
  on public.pantry_staples for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_staples_delete"
  on public.pantry_staples for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));
