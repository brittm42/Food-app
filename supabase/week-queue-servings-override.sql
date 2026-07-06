-- Lets a household adjust a queued recipe's serving count for the week
-- without changing the recipe's own default `servings` value. Null means
-- "use the recipe's default servings."
alter table week_queue add column if not exists servings_override integer;

-- week_queue never needed an UPDATE policy before (only select/insert/delete
-- existed) — without this, setServingsOverride's UPDATE is silently blocked
-- by RLS (0 rows affected, no error), matching the same gotcha hit during
-- the household-rename fix.
drop policy if exists "week_queue_update" on public.week_queue;

create policy "week_queue_update"
  on public.week_queue for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));
