import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";

const KROGER_AUTHORIZE_URL = "https://api.kroger.com/v1/connect/oauth2/authorize";
const STATE_COOKIE = "kroger_oauth_state";

// Only allow a same-site, single-leading-slash path — anything else (a full
// URL, or a protocol-relative "//evil.com") could turn the post-callback
// redirect into an open redirect.
function isSafeReturnPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

// Kicks off the OAuth authorization_code flow: the household's owner/manager
// is redirected to Kroger to log into their real King Soopers/Kroger account
// and approve cart access. Resumes at app/api/kroger/callback/route.ts.
export async function GET(request: NextRequest) {
  const household = await getCurrentHousehold();
  if (!household) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isPrivileged(household.role)) {
    return NextResponse.json(
      { error: "Only the household owner or a manager can connect Kroger." },
      { status: 403 }
    );
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Kroger integration isn't configured." }, { status: 500 });
  }

  const requestedReturnTo = request.nextUrl.searchParams.get("returnTo") ?? "/account/household";
  const returnTo = isSafeReturnPath(requestedReturnTo) ? requestedReturnTo : "/account/household";

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/kroger/callback", request.url).toString();

  const authorizeUrl = new URL(KROGER_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "cart.basic:write profile.compact");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/kroger",
  });
  return response;
}
