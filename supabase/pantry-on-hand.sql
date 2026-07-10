-- Run this in the Supabase dashboard's SQL Editor.
--
-- Pantry on-hand quantity tracking, for the Shopping List reconciliation
-- feature: "I have 4 cans of black beans, this week's recipes need 1,
-- don't tell me to buy more." One row per household per ingredient name
-- (normalized case/whitespace-insensitively via the unique index below).
-- Deliberately a new table, not an extension of `pantry_staples` (a
-- different concept: a freeform always-keep-in-stock list, not tied to
-- recipe ingredient names) or the static `CORE_PANTRY` catalog in
-- lib/types.ts (stays static in code; many core-tagged recipe ingredients
-- fall outside that 40-item list already).
--
-- quantity_value/quantity_unit are both nullable: a household can have a
-- row for an ingredient with no quantity set yet (not meaningfully
-- different from no row at all, but simplifies upserts from the UI).
--
-- ingredient_name is ALWAYS stored pre-normalized (trimmed + lowercased) by
-- the app layer (app/actions/pantry-on-hand.ts) — this table is a lookup
-- key, never rendered directly (the UI always has the real display label
-- from CORE_PANTRY or a recipe's ingredient name already). That lets the
-- unique constraint be a plain column list, so Supabase's native upsert
-- (`on_conflict=household_id,ingredient_name`) works — a unique index on
-- an expression like lower(trim(...)) can't be targeted by PostgREST's
-- upsert, which only accepts a literal column list.

create table public.pantry_on_hand (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_name text not null,
  quantity_value numeric,
  quantity_unit text,
  updated_at timestamptz not null default now(),
  unique (household_id, ingredient_name)
);

alter table public.pantry_on_hand enable row level security;

create policy "pantry_on_hand_select"
  on public.pantry_on_hand for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "pantry_on_hand_insert"
  on public.pantry_on_hand for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()));

-- Primary write path is an in-place edit (upsert on the unique index
-- above), so an UPDATE policy is required — see the same gotcha documented
-- in week-queue-servings-override.sql (a table with only select/insert/
-- delete silently blocks UPDATEs under RLS: 0 rows affected, no error).
create policy "pantry_on_hand_update"
  on public.pantry_on_hand for update
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy "pantry_on_hand_delete"
  on public.pantry_on_hand for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));
