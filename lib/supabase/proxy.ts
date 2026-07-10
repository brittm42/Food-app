import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api isn't listed here — it's excluded from the middleware matcher
// entirely (proxy.ts) rather than just marked public, so this function
// never runs for those routes at all. See proxy.ts for why.
const PUBLIC_PATHS = ["/login", "/auth", "/invite", "/privacy"];

// Paths a signed-in user with unfinished onboarding can still reach without
// being bounced to /onboarding — lets them go straight to /account/preferences
// on their own, or finish/skip the onboarding page itself.
const ONBOARDING_EXEMPT_PATHS = ["/onboarding", "/account", "/profile"];

// Cache the outcome of the household/onboarding checks in cookies so
// returning users skip those queries entirely on most requests. Onboarding
// status is one-way and only the user themself changes it, so it's safe to
// cache for a long time. Household membership can be changed by someone
// else (an owner removing a member) with no way to reach into the removed
// user's browser and clear their cookie, so it gets a short TTL instead —
// a removed member self-heals (falls through to the real check, which
// re-creates a personal household) within that window rather than staying
// permanently stuck believing they still have their old household.
const ONBOARDING_CACHE_COOKIE = "wn-ob-ok";
const ONBOARDING_CACHE_MAX_AGE = 90 * 24 * 60 * 60;
const HOUSEHOLD_CACHE_COOKIE = "wn-hh-ok";
const HOUSEHOLD_CACHE_MAX_AGE = 6 * 60 * 60;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Verifies the JWT's signature rather than just trusting the (possibly
  // forged) cookie — required for proxy-level checks. This project signs
  // with an asymmetric key (ES256), so getClaims() verifies locally against
  // a cached JWKS instead of making a network round trip to the Auth server
  // on every request the way getUser() always does. Falls back to a
  // getUser()-equivalent network check automatically if that ever changes.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  // "/" is a special case: it's the signed-out marketing landing page, but
  // also the signed-in recipes home — so it only skips the login redirect
  // below, not the household/onboarding checks further down.
  const isRoot = pathname === "/";

  if (!userId && !isPublicPath && !isRoot) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (userId && !isPublicPath) {
    const isOnboardingExempt = ONBOARDING_EXEMPT_PATHS.some((path) =>
      pathname.startsWith(path)
    );
    const householdCached =
      request.cookies.get(HOUSEHOLD_CACHE_COOKIE)?.value === "1";
    const onboardingCached =
      request.cookies.get(ONBOARDING_CACHE_COOKIE)?.value === "1";
    const needsHouseholdCheck = !householdCached;
    const needsProfileCheck = !isOnboardingExempt && !onboardingCached;

    // Household membership and onboarding status don't depend on each
    // other, so they run in parallel rather than as sequential round trips
    // — and are skipped entirely once cached (see cookie comments above).
    const [{ data: membership }, { data: profile }] = await Promise.all([
      // Every signed-in user needs a household to use This Week/Pantry/
      // Shopping (they're all household-scoped). Invited users get one via
      // acceptInvite() before they ever reach a non-public path; anyone else
      // (self-signup with no invite) falls through to here and gets a
      // personal household created lazily on their first real page load.
      needsHouseholdCheck
        ? supabase
            .from("household_members")
            .select("household_id")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      needsProfileCheck
        ? supabase
            .from("profiles")
            .select("onboarding_status")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (needsHouseholdCheck) {
      if (!membership) {
        // Generate the id ourselves rather than using .select() to read it
        // back after insert: households_select requires household_members
        // membership, which doesn't exist yet for a brand-new household, so
        // the RETURNING read gets filtered by RLS and Postgres reports the
        // whole insert as a policy violation.
        const householdId = crypto.randomUUID();
        const { error: newHouseholdError } = await supabase
          .from("households")
          .insert({ id: householdId });

        if (!newHouseholdError) {
          await supabase.from("household_members").insert({
            household_id: householdId,
            user_id: userId,
            role: "owner",
          });
        }
      }
      response.cookies.set(HOUSEHOLD_CACHE_COOKIE, "1", {
        maxAge: HOUSEHOLD_CACHE_MAX_AGE,
      });
    }

    if (!isOnboardingExempt && needsProfileCheck) {
      if (!profile || profile.onboarding_status === "pending") {
        // Built from `response` rather than a bare NextResponse.redirect so
        // the household cache cookie just set above (and any auth cookie
        // refreshed during getClaims()) isn't silently dropped — this
        // redirect fires on essentially every brand-new user's very first
        // request.
        const redirectResponse = NextResponse.redirect(
          new URL("/onboarding", request.url)
        );
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie);
        });
        return redirectResponse;
      }
      response.cookies.set(ONBOARDING_CACHE_COOKIE, "1", {
        maxAge: ONBOARDING_CACHE_MAX_AGE,
      });
    }
  }

  return response;
}
