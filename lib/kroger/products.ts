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

// The review screen re-searches the same handful of recurring ingredient
// names on every page load (often several times in one testing/shopping
// session) — a short-lived cache avoids re-hitting Kroger for the same term
// repeatedly, cutting both latency and the request volume that risks
// tripping rate limiting. Keyed to include locationId: without a location,
// results are generic catalog data (no real price/availability); with one,
// they're store-specific, so two households at different stores must never
// share a cache entry.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { result: KrogerProductMatch[]; expiresAt: number }>();

export async function searchProduct(
  term: string,
  limit = 3,
  locationId?: string | null
): Promise<KrogerProductMatch[]> {
  const normalized = normalizeTerm(term);
  const cacheKey = `${locationId ?? "none"}::${normalized.toLowerCase()}::${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  const accessToken = await getProductsAccessToken();

  const url = new URL(KROGER_PRODUCTS_URL);
  url.searchParams.set("filter.term", normalized);
  url.searchParams.set("filter.limit", String(limit));
  if (locationId) url.searchParams.set("filter.locationId", locationId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger product search failed (${response.status}): ${text}`);
  }

  const body: KrogerProductsResponse = await response.json();
  const result = (body.data ?? []).map((p) => ({
    upc: p.upc,
    description: p.description,
    brand: p.brand ?? null,
  }));

  cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
