-- Run this in the Supabase dashboard's SQL Editor.
--
-- Phase A of the household-preferences initiative (data model only — the
-- onboarding wizard that will capture this per-person is a later change).
-- Allergies gain severity + handling instead of being a flat name (text[]
-- -> jsonb), two new per-person fields (dietary_style, health_goals), and
-- four new household-level cooking-context fields on `households`.

begin;

-- === profiles: allergy detail =================================

-- Existing entries have no real severity/handling data to migrate from, so
-- they get the maximally protective default (severe / strict_avoidance)
-- rather than guessing something less safe. New entries saved through the
-- app going forward will carry real values captured at entry time.
--
-- ALTER COLUMN ... USING can't contain a raw subquery (Postgres: "cannot
-- use subquery in transform expression"), even a simple unnest-based one —
-- wrapping the conversion in a function makes it a plain scalar function
-- call from ALTER TABLE's perspective, which is allowed. Created in
-- pg_temp so it's session-scoped and never lingers in the public schema.
create function pg_temp._migrate_allergies_to_detail(old_allergies text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('name', a, 'severity', 'severe', 'handling', 'strict_avoidance')
      )
      from unnest(old_allergies) as a
    ),
    '[]'::jsonb
  )
$$;

alter table public.profiles alter column allergies drop default;

alter table public.profiles
  alter column allergies type jsonb
  using pg_temp._migrate_allergies_to_detail(allergies);

alter table public.profiles alter column allergies set default '[]'::jsonb;
alter table public.profiles alter column allergies set not null;

-- === profiles: new per-person fields ===========================

alter table public.profiles add column if not exists dietary_style text[] not null default '{}';
alter table public.profiles add column if not exists health_goals text[] not null default '{}';

-- No RLS changes needed here: profiles_select/insert/update policies key
-- off user_id/member_id only, never the allergies column's type or the new
-- columns, so the existing policies from
-- household-roles-dependents-preferences.sql are unaffected.

-- === households: new household-level cooking-context fields ====

alter table public.households add column if not exists household_size integer;
alter table public.households add column if not exists meal_priorities text[];
alter table public.households add column if not exists weeknight_time_minutes integer;
alter table public.households add column if not exists skill_level text
  check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced'));

-- === households: close a pre-existing manager gap ===============
-- households_update (from household-name-and-remove-member.sql) only ever
-- allowed the strict 'owner' role, predating is_household_privileged()
-- (added later by household-roles-dependents-preferences.sql for
-- everything else). Left as-is, a manager saving the new cooking-profile
-- fields below would silently fail (0 rows updated). Repointing at
-- is_household_privileged() makes it consistent with every other
-- owner/manager action in the app (updateMemberRole, createDependentProfile, etc).
drop policy if exists "households_update" on public.households;
create policy "households_update"
  on public.households for update
  to authenticated
  using (public.is_household_privileged(id))
  with check (public.is_household_privileged(id));

commit;
