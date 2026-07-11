import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto/secrets";

const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";

// Refresh a bit before actual expiry so a slow request never straddles the
// boundary and gets a 401 mid-call.
const REFRESH_SKEW_SECONDS = 60;

type KrogerTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KROGER_CLIENT_ID/KROGER_CLIENT_SECRET are not set.");
  }
  return { clientId, clientSecret };
}

async function requestToken(body: URLSearchParams): Promise<KrogerTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger token request failed (${response.status}): ${text}`);
  }

  return response.json();
}

export function exchangeAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<KrogerTokenResponse> {
  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    })
  );
}

function refreshWithToken(refreshToken: string): Promise<KrogerTokenResponse> {
  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

// Encrypts and upserts a household's connection row. Used both right after
// the OAuth callback (initial connect) and whenever a refresh grant returns
// fresh tokens.
export async function storeConnection(
  householdId: string,
  tokens: KrogerTokenResponse,
  connectedBy?: string
) {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await admin.from("kroger_connections").upsert(
    {
      household_id: householdId,
      access_token_ciphertext: encrypt(tokens.access_token),
      // Kroger's refresh grant doesn't always return a new refresh_token —
      // when it doesn't, the existing one is still valid and must be kept.
      ...(tokens.refresh_token ? { refresh_token_ciphertext: encrypt(tokens.refresh_token) } : {}),
      expires_at: expiresAt,
      ...(connectedBy ? { connected_by: connectedBy } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" }
  );

  if (error) throw new Error(`Failed to store Kroger connection: ${error.message}`);
}

// Returns a valid access token for the household, refreshing first if it's
// expired or about to be. Throws if the household has no connection.
export async function getValidAccessToken(householdId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: connection, error } = await admin
    .from("kroger_connections")
    .select("access_token_ciphertext, refresh_token_ciphertext, expires_at")
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up Kroger connection: ${error.message}`);
  if (!connection) throw new Error("Household has no Kroger connection.");

  const expiresAt = new Date(connection.expires_at).getTime();
  const isExpiringSoon = expiresAt - Date.now() < REFRESH_SKEW_SECONDS * 1000;

  if (!isExpiringSoon) {
    return decrypt(connection.access_token_ciphertext);
  }

  const refreshToken = decrypt(connection.refresh_token_ciphertext);
  const tokens = await refreshWithToken(refreshToken);
  await storeConnection(householdId, tokens);
  return tokens.access_token;
}
