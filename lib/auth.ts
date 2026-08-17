import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AuthClaims = {
  id: string;
  email: string | null;
  appMetadata: Record<string, unknown>;
};

// Memoized per-request (React's cache()) so the root layout, the page, and
// any helpers that need "who's signed in" during the same request only pay
// for one auth check, not one each — previously every page (plus the
// layout, plus lib/household.ts) independently called supabase.auth.
// getUser(), each a real network round trip to the Supabase Auth server.
// getClaims() verifies the JWT locally (cached JWKS, no network round
// trip) — the same method proxy.ts's middleware already uses to protect
// routes, per Supabase's own docs: "Use getClaims to protect pages and
// user data... use getUser when you need an up-to-date user record from
// the Auth server." All three fields every call site in this app actually
// needs (id, email, app_metadata.providers) are present in the JWT claims.
export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const claims = data.claims as {
    sub: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
  };

  return {
    id: claims.sub,
    email: claims.email ?? null,
    appMetadata: claims.app_metadata ?? {},
  };
});
