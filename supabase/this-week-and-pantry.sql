-- Run this in the Supabase dashboard's SQL Editor.
-- Adds the `week_queue` table (Feature 4: This Week) and `pantry_state`
-- table (used by both Feature 5's shopping-list checkboxes and Feature 6's
-- Pantry checklists — same "checked state by item key" shape, namespaced
-- by a prefix on item_key so the two screens don't collide).

create table public.week_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.week_queue enable row level security;

create policy "week_queue_select"
  on public.week_queue for select
  to authenticated
  using (user_id = auth.uid());

create policy "week_queue_insert"
  on public.week_queue for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "week_queue_delete"
  on public.week_queue for delete
  to authenticated
  using (user_id = auth.uid());

create table public.pantry_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  checked_at timestamptz not null default now(),
  unique (user_id, item_key)
);

alter table public.pantry_state enable row level security;

create policy "pantry_state_select"
  on public.pantry_state for select
  to authenticated
  using (user_id = auth.uid());

create policy "pantry_state_insert"
  on public.pantry_state for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "pantry_state_delete"
  on public.pantry_state for delete
  to authenticated
  using (user_id = auth.uid());
