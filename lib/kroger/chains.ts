// Kroger Co. operates many regional banners under one platform — a
// location's `chain` code (from the Locations API) tells us which one a
// given household actually shops at, so the app can say "King Soopers"
// instead of a generic "Kroger" without hardcoding it per household. Not
// exhaustive — falls back to a readable guess for any banner not listed.
const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  KINGSOOPERS: "King Soopers",
  RALPHS: "Ralphs",
  FREDMEYER: "Fred Meyer",
  FREDS: "Fred's",
  QFC: "QFC",
  SMITHS: "Smith's",
  FRYS: "Fry's",
  HARRISTEETER: "Harris Teeter",
  DILLONS: "Dillons",
  CITYMARKET: "City Market",
  FOODSCO: "Food 4 Less",
  PAYLESS: "Pay Less",
  BAKERS: "Baker's",
  GERBES: "Gerbes",
  JAYC: "JayC",
  OWEN: "Owen's",
  METROMARKET: "Metro Market",
  PICKNSAVE: "Pick 'n Save",
  MARIANOS: "Mariano's",
  KROGER: "Kroger",
};

export function displayNameForChain(chain: string | null | undefined): string {
  if (!chain) return "Kroger";
  const known = CHAIN_DISPLAY_NAMES[chain.toUpperCase().replace(/[^A-Z]/g, "")];
  if (known) return known;
  // Fallback: title-case the raw code rather than showing something like
  // "KINGSOOPERS" verbatim for an unmapped banner.
  return chain
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
