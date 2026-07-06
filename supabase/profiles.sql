-- Run this in the Supabase dashboard's SQL Editor.
-- Covers: display name, the first field in the revamped /account area.
-- One row per user, created lazily on first save (not on sign-up), since
-- most users won't touch this until they visit /account/profile.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Deliberately no cross-user select policy: the Household member list reads
-- display names via the admin client (service role), same pattern already
-- used there to read member emails from auth.users.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
