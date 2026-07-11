import { getProductsAccessToken } from "./productsToken";

const KROGER_PRODUCTS_URL = "https://api.kroger.com/v1/products";

export type KrogerProductMatch = {
  upc: string;
  description: string;
  brand: string | null;
};

type KrogerProductsResponse = {
  data: {
    upc: string;
    description: string;
    brand?: string | null;
  }[];
};

// Kroger's filter.term has a length cap; truncate defensively rather than
// letting a long recipe-ingredient name (e.g. "boneless skinless chicken
// breast, cut into strips") fail the request outright.
function normalizeTerm(term: string): string {
  return term.trim().slice(0, 60);
}

export async function searchProduct(term: string, limit = 3): Promise<KrogerProductMatch[]> {
  const accessToken = await getProductsAccessToken();

  const url = new URL(KROGER_PRODUCTS_URL);
  url.searchParams.set("filter.term", normalizeTerm(term));
  url.searchParams.set("filter.limit", String(limit));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger product search failed (${response.status}): ${text}`);
  }

  const body: KrogerProductsResponse = await response.json();
  return (body.data ?? []).map((p) => ({
    upc: p.upc,
    description: p.description,
    brand: p.brand ?? null,
  }));
}
