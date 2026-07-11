import { getValidAccessToken } from "./tokens";

const KROGER_CART_ADD_URL = "https://api.kroger.com/v1/cart/add";

export type CartItem = {
  upc: string;
  quantity: number;
};

// Kroger's Cart API is add-only (no remove endpoint) — a 204 means the
// items landed in the household's real, persistent cart. Household-scoped,
// unlike Products search: this needs the specific household's own
// authorization_code token, not the app-level client_credentials one.
export async function addToCart(householdId: string, items: CartItem[]): Promise<void> {
  if (items.length === 0) return;

  const accessToken = await getValidAccessToken(householdId);

  const response = await fetch(KROGER_CART_ADD_URL, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: items.map((item) => ({ upc: item.upc, quantity: item.quantity })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger cart add failed (${response.status}): ${text}`);
  }
}
