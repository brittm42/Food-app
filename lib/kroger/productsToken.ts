const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";

// Products search is app-level, not household-level — it uses Kroger's
// client_credentials grant (no user login), unlike Cart writes which need a
// specific household's authorization_code tokens (lib/kroger/tokens.ts). One
// process-wide token is fine here since it isn't tied to any household;
// cached in memory only, nothing to persist.
let cached: { accessToken: string; expiresAt: number } | null = null;

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KROGER_CLIENT_ID/KROGER_CLIENT_SECRET are not set.");
  }
  return { clientId, clientSecret };
}

export async function getProductsAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.accessToken;
  }

  const { clientId, clientSecret } = getClientCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "product.compact",
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger products token request failed (${response.status}): ${text}`);
  }

  const data: { access_token: string; expires_in: number } = await response.json();
  cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.accessToken;
}
