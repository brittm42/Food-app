import { getProductsAccessToken } from "./productsToken";

const KROGER_LOCATIONS_URL = "https://api.kroger.com/v1/locations";

export type KrogerLocation = {
  locationId: string;
  chain: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
};

type KrogerLocationsResponse = {
  data: {
    locationId: string;
    chain: string;
    name: string;
    address: { addressLine1: string; city: string; state: string; zipCode: string };
  }[];
};

// Locations is an app-level, not household-level, API (same client_credentials
// token as Products search — confirmed live that the product.compact-scoped
// token also authorizes this endpoint).
export async function searchLocations(zipCode: string, limit = 5): Promise<KrogerLocation[]> {
  const accessToken = await getProductsAccessToken();

  const url = new URL(KROGER_LOCATIONS_URL);
  url.searchParams.set("filter.zipCode.near", zipCode.trim());
  url.searchParams.set("filter.limit", String(limit));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger location search failed (${response.status}): ${text}`);
  }

  const body: KrogerLocationsResponse = await response.json();
  return (body.data ?? []).map((loc) => ({
    locationId: loc.locationId,
    chain: loc.chain,
    name: loc.name,
    addressLine1: loc.address?.addressLine1 ?? "",
    city: loc.address?.city ?? "",
    state: loc.address?.state ?? "",
    zipCode: loc.address?.zipCode ?? "",
  }));
}
