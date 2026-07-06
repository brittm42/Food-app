-- Run this in the Supabase dashboard's SQL Editor.
-- Covers: household roles (adds "manager", equal to owner), dependent
-- profiles (people with no login of their own, e.g. a kid, managed by an
-- owner/manager), and food preferences on `profiles` (allergies, foods to
-- avoid, cuisine preferences, onboarding status) that feed the new
-- onboarding flow and AI recipe generation.

-- === Roles ===================================================

-- Find the role check constraint by definition rather than assumed name,
-- since Postgres' auto-naming for inline column checks isn't guaranteed.
do $$
declare
  existing_check text;
begin
  select con.conname into existing_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'household_members'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%role%';
  if existing_check is not null then
    execute format('alter table public.household_members drop constraint %I', existing_check);
  end if;
end $$;

alter table public.household_members add constraint household_members_role_check
  check (role in ('owner', 'manager', 'member', 'dependent'));

-- Dependents have no login, so no auth.users row to point at.
alter table public.household_members alter column user_id drop not null;

create or replace function public.is_household_privileged(target_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_household_role(target_household_id) in ('owner', 'manager')
$$;

-- A privileged member (owner/manager) can insert a dependent row (no
-- user_id) in their own household; a real signup still inserts its own
-- row as before.
drop policy if exists "household_members_insert" on public.household_members;
create policy "household_members_insert"
  on public.household_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or (user_id is null and public.is_household_privileged(household_id))
  );

-- Owners/managers can remove members, managers, and dependents — never
-- the owner row itself.
drop policy if exists "household_members_delete" on public.household_members;
create policy "household_members_delete"
  on public.household_members for delete
  to authenticated
  using (
    role in ('member', 'manager', 'dependent')
    and public.is_household_privileged(household_id)
  );

-- New: promote/demote member <-> manager. Can't touch the owner row or
-- flip anyone into/out of 'dependent' through this policy.
create policy "household_members_update"
  on public.household_members for update
  to authenticated
  using (
    role in ('member', 'manager')
    and public.is_household_privileged(household_id)
  )
  with check (role in ('member', 'manager'));

-- === Dependent-aware, preference-carrying profiles ===========

alter table public.profiles add column if not exists id uuid default gen_random_uuid();
update public.profiles set id = gen_random_uuid() where id is null;
alter table public.profiles alter column id set not null;
alter table public.profiles drop constraint if exists profiles_pkey;
alter table public.profiles add primary key (id);

alter table public.profiles alter column user_id drop not null;
alter table public.profiles add constraint profiles_user_id_key unique (user_id);

-- A dependent's profile links to their household_members row instead of
-- a user_id. Kept nullable + unique the same way, so a future "promote
-- this dependent to a real login" just means setting user_id on this same
-- row — no data migration needed then.
alter table public.profiles add column if not exists member_id uuid
  references public.household_members (id) on delete cascade unique;

alter table public.profiles add constraint profiles_has_an_owner
  check (user_id is not null or member_id is not null);

alter table public.profiles add column if not exists allergies text[] not null default '{}';
alter table public.profiles add column if not exists avoid_foods text[] not null default '{}';
alter table public.profiles add column if not exists cuisine_preferences text[] not null default '{}';
alter table public.profiles add column if not exists onboarding_status text
  not null default 'pending' check (onboarding_status in ('pending', 'skipped', 'completed'));

-- Grandfather in everyone already using the app before this migration —
-- onboarding is for new users going forward, not a surprise for existing
-- ones. Anyone who already has a real household membership is marked
-- completed, whether or not they'd already saved a display name.
insert into public.profiles (user_id, onboarding_status)
select hm.user_id, 'completed'
from public.household_members hm
where hm.user_id is not null
on conflict (user_id) do update set onboarding_status = 'completed';

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create or replace function public.household_id_for_member(target_member_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where id = target_member_id
$$;

-- Anyone can read their own profile; household mates can also see each
-- other's (and dependents') profiles — allergies/preferences need to be
-- visible to whoever's picking recipes for the household.
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (
    user_id = auth.uid()
    or user_id in (
      select hm.user_id from public.household_members hm
      where hm.household_id in (select public.current_household_ids())
      and hm.user_id is not null
    )
    or member_id in (
      select hm.id from public.household_members hm
      where hm.household_id in (select public.current_household_ids())
    )
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profiles_insert_dependent"
  on public.profiles for insert
  to authenticated
  with check (
    member_id is not null
    and public.is_household_privileged(public.household_id_for_member(member_id))
  );

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles_update_dependent"
  on public.profiles for update
  to authenticated
  using (
    member_id is not null
    and public.is_household_privileged(public.household_id_for_member(member_id))
  )
  with check (
    member_id is not null
    and public.is_household_privileged(public.household_id_for_member(member_id))
  );
