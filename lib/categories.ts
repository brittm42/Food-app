// Shared grocery-aisle taxonomy for Pantry + Shopping List items. One list,
// used both as the Claude categorizer's enum (lib/categorize.ts) and to
// order sections in the UI — keeping it in one place means the two screens
// can never drift into different category sets for the same item.
export const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Frozen",
  "Bakery",
  "Canned Goods",
  "Grains & Dried",
  "Sauces & Condiments",
  "Spices",
  "Beverages",
  "Snacks",
  "Household & Non-food",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
