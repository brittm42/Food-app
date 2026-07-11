-- Run this in the Supabase dashboard's SQL Editor.
--
-- Follow-up to alexa-linked-accounts.sql: a household should be able to
-- link more than one Amazon account (e.g. separate Echo devices tied to
-- different logins) — they're all just adding to the same shared shopping
-- list, so there's no reason to force a single slot. Flips the uniqueness
-- constraint: household_id no longer unique (a household can have many
-- rows), linked_email now unique instead (an email can still only ever
-- resolve to one household, which is what keeps the Alexa route's lookup
-- unambiguous).

alter table public.alexa_linked_accounts drop constraint alexa_linked_accounts_household_id_key;

drop index if exists public.alexa_linked_accounts_email_idx;

create unique index alexa_linked_accounts_email_unique_idx
  on public.alexa_linked_accounts (lower(linked_email));
