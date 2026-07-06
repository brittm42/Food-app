import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/invite"];

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
