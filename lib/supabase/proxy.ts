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

  // Revalidates the session with Supabase's Auth server rather than just
  // reading the (possibly stale/forged) cookie — required for proxy-level checks.
  const { data } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!data.user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (data.user && !isPublicPath) {
    // Every signed-in user needs a household to use This Week/Pantry/
    // Shopping (they're all household-scoped). Invited users get one via
    // acceptInvite() before they ever reach a non-public path; anyone else
    // (self-signup with no invite) falls through to here and gets a
    // personal household created lazily on their first real page load.
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

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
          user_id: data.user.id,
          role: "owner",
        });
      }
    }

    const isOnboardingExempt = ONBOARDING_EXEMPT_PATHS.some((path) =>
      pathname.startsWith(path)
    );
    if (!isOnboardingExempt) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile || profile.onboarding_status === "pending") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  return response;
}
