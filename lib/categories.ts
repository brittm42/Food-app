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
  "Cleaning Supplies",
  "Paper Goods",
  "Laundry",
  "Toiletries & Personal Care",
  "Other Household",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

// The literal perimeter-of-the-store vs. center-aisle split (Britt's
// framing, 2026-07-10): Fresh is perishable regardless of how/whether it's
// stocked-tracked; everything else (including Frozen) is Pantry. This is
// the only place that distinction is defined — Home Stock, Shopping List,
// and the pantry_items in-stock tracking behavior all derive from this
// rather than each keeping their own notion of "fresh."
export const FRESH_CATEGORIES: readonly Category[] = ["Produce", "Dairy & Eggs", "Meat & Seafood", "Bakery"];

export function isFreshCategory(category: string): boolean {
  return (FRESH_CATEGORIES as readonly string[]).includes(category);
}

// Non-food home-inventory categories (cleaning supplies, paper goods, …) —
// Home Stock's third tab, alongside Fresh and Pantry. Never populated from
// recipe ingredients, only from manual/voice adds.
export const HOUSEHOLD_CATEGORIES: readonly Category[] = [
  "Cleaning Supplies",
  "Paper Goods",
  "Laundry",
  "Toiletries & Personal Care",
  "Other Household",
];

export function isHouseholdCategory(category: string): boolean {
  return (HOUSEHOLD_CATEGORIES as readonly string[]).includes(category);
}

export type Section = "fresh" | "pantry" | "household";

export function sectionForCategory(category: string): Section {
  if (isFreshCategory(category)) return "fresh";
  if (isHouseholdCategory(category)) return "household";
  return "pantry";
}
