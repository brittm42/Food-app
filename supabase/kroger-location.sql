-- Run this in the Supabase dashboard's SQL Editor.
--
-- A household's Kroger connection needs to know which physical store they
-- shop at — without a locationId, Kroger's Products API returns generic
-- catalog data with no real price/availability/fulfillment info (confirmed
-- live: every fulfillment flag comes back false and there's no price at
-- all without one). location_chain (Kroger's raw banner code, e.g.
-- "KINGSOOPERS") drives the display-name lookup in lib/kroger/chains.ts so
-- the app can say "King Soopers" instead of generic "Kroger" wherever
-- relevant, without hardcoding it per household.
--
-- Nullable because existing connections (made before this column existed)
-- won't have one yet — the app treats a connected-but-locationless household
-- as "finish setup" rather than fully connected.

alter table public.kroger_connections add column if not exists location_id text;
alter table public.kroger_connections add column if not exists location_name text;
alter table public.kroger_connections add column if not exists location_chain text;
