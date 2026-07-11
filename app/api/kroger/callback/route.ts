import { NextResponse, type NextRequest } from "next/server";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";
import { exchangeAuthorizationCode, storeConnection } from "@/lib/kroger/tokens";

const STATE_COOKIE = "kroger_oauth_state";

function redirectWithError(request: NextRequest, returnTo: string, message: string) {
  const url = new URL(returnTo, request.url);
  url.searchParams.set("kroger_error", message);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  let stored: { state: string; returnTo: string } | null = null;
  try {
    stored = stateCookie ? JSON.parse(stateCookie) : null;
  } catch {
    stored = null;
  }
  const returnTo = stored?.returnTo ?? "/account/household";

  const params = request.nextUrl.searchParams;
  const kroDenied = params.get("error");
  if (kroDenied) {
    return redirectWithError(request, returnTo, "Kroger connection was cancelled.");
  }

  const state = params.get("state");
  const code = params.get("code");
  if (!stored || !state || state !== stored.state || !code) {
    return redirectWithError(request, returnTo, "Kroger connection failed. Please try again.");
  }

  const household = await getCurrentHousehold();
  if (!household || !isPrivileged(household.role)) {
    return redirectWithError(request, returnTo, "You must be signed in as an owner or manager.");
  }

  try {
    const redirectUri = new URL("/api/kroger/callback", request.url).toString();
    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    await storeConnection(household.householdId, tokens, household.userId);
  } catch (err) {
    console.error("Kroger token exchange failed:", err);
    return redirectWithError(request, returnTo, "Kroger connection failed. Please try again.");
  }

  const url = new URL(returnTo, request.url);
  url.searchParams.set("kroger", "connected");
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}
