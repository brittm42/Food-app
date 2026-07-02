-- Run this in the Supabase dashboard's SQL Editor.
-- Introduces the `households` concept (Post-MVP: account management +
-- multi-user). Phase 1 only: creates the household tables, puts Britt into
-- her own household, and migrates the three tables that become
-- household-shared (This Week, Pantry state, Pantry staples) from
-- `user_id`-scoped to `household_id`-scoped. Recipes, ratings, and oat
-- picks are deliberately untouched — they stay personal per user.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  created_at timestamptz not null default now()
);

-- A person belongs to exactly one household at a time (unique on user_id).
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (user_id)
);

-- Invite records for Phase 2's invite flow. No client-facing RLS policies
-- at all — an invited person isn't authenticated yet when they need to
-- resolve their invite token, so every read/write goes through a
-- service-role admin client (see lib/supabase/admin.ts) instead.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id)
);

-- RLS: all three tables reference household_members in their policies, so
-- policies are added only after all three tables exist (Postgres validates
-- relation references at CREATE POLICY time, not just at query time).
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- A policy on household_members that subqueries household_members itself
-- triggers "infinite recursion detected in policy" (Postgres re-applies
-- the same RLS policy while evaluating the subquery). The standard fix is
-- a SECURITY DEFINER function: since it's owned by the postgres role (which
-- has BYPASSRLS), the lookup inside it skips RLS entirely instead of
-- recursing. Every policy below that needs "which household is this user
-- in" calls this function rather than querying household_members directly.
create or replace function public.current_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create policy "households_select"
  on public.households for select
  to authenticated
  using (id in (select public.current_household_ids()));

create policy "households_insert"
  on public.households for insert
  to authenticated
  with check (true);

create policy "household_members_select"
  on public.household_members for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy "household_members_insert"
  on public.household_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Seed: one household for Britt, containing just her, as owner.
with new_household as (
  insert into public.households (name) values ('Home') returning id
)
insert into public.household_members (household_id, user_id, role)
select new_household.id, auth.users.id, 'owner'
from new_household, auth.users
where auth.users.email = 'brittany.madruga@gmail.com';

-- week_queue: user_id-scoped -> household_id-scoped.
alter table public.week_queue add column household_id uuid references public.households (id) on delete cascade;

update public.week_queue wq
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = wq.user_id;

alter table public.week_queue alter column household_id set not null;

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

-- pantry_state: user_id-scoped -> household_id-scoped. Uniqueness moves
-- from (user_id, item_key) to (household_id, item_key) since checked
-- state is now shared across the household, not per person.
alter table public.pantry_state add column household_id uuid references public.households (id) on delete cascade;

update public.pantry_state ps
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = ps.user_id;

alter table public.pantry_state alter column household_id set not null;

alter table public.pantry_state drop constraint pantry_state_user_id_item_key_key;
alter table public.pantry_state add constraint pantry_state_household_id_item_key_key unique (household_id, item_key);

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

-- pantry_staples: user_id-scoped -> household_id-scoped (the item list
-- itself is now shared, matching the now-shared Pantry tab and Shopping
-- List it surfaces on).
alter table public.pantry_staples add column household_id uuid references public.households (id) on delete cascade;

update public.pantry_staples ps
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = ps.user_id;

alter table public.pantry_staples alter column household_id set not null;

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
