-- Self-serve Shortcut setup (backlog item 2, feature_backlog_priority):
-- lets a signed-in user generate/view their own voice_integration_tokens
-- row from a personal account settings page, instead of needing someone
-- with server access to run scripts/create-voice-token.mjs for them.
--
-- user_id is nullable so the existing script-created rows (Britt's and
-- Jason's iPhones) stay valid untouched — they just aren't attributable to
-- a specific self-serve row until/unless someone regenerates via the app.
alter table public.voice_integration_tokens
  add column user_id uuid references auth.users (id) on delete cascade;

-- One self-serve token per person per household — regenerating replaces
-- the existing row rather than accumulating duplicates. Partial index so
-- it only applies to self-serve rows (user_id not null); the older
-- script-created rows aren't constrained by this.
create unique index voice_integration_tokens_household_user_unique
  on public.voice_integration_tokens (household_id, user_id)
  where user_id is not null;
