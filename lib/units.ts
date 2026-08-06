// Bounded, deterministic unit handling for pantry reconciliation (Shopping
// List vs. on-hand quantities). Three closed dimensions, no cross-dimension
// conversion (e.g. never weight <-> volume, which needs ingredient density
// and can't be done generally) — anything outside this vocabulary, or a
// needed/on-hand pair in mismatched dimensions, is left "unknown" so the
// caller can fail open (keep listing the item) rather than invent false
// confidence.

import { parseQuantity } from "./scale-quantity";

type Dimension = "weight" | "volume" | "count";

type UnitDef = {
  dimension: Dimension;
  toBase: number;
  // Whether this belongs in the purchase-quantity dropdown (Home Stock's
  // "usual amount to buy," Shopping List quantities). Recipe ingredient
  // units are always free-text (typed, not picked from this list) and get
  // canonicalized against the full vocabulary regardless of this flag — a
  // handful of units (tsp, tbsp, cup, clove, ml) are real recipe
  // measurements that are never how someone thinks of "how much I buy," so
  // they're excluded here to keep that dropdown to units Britt actually
  // shops in.
  purchaseUnit: boolean;
  // Dropdown sort order for purchase units, most-likely-to-least-likely
  // (Britt's ask: "sorted by probability of use," not alphabetical or
  // insertion order). Irrelevant for non-purchase units.
  priority: number;
};

// Weight base unit: grams. Volume base unit: milliliters. Count units have
// no real conversion factor — each one only reconciles against the exact
// same unit string (a "can" is never compared to a "clove").
const UNIT_DEFS: Record<string, UnitDef> = {
  bag: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 1 },
  box: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 2 },
  can: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 3 },
  jar: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 4 },
  bottle: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 5 },
  carton: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 6 },
  package: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 7 },
  count: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 8 },
  whole: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 9 },
  dozen: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 10 },
  lb: { dimension: "weight", toBase: 453.592, purchaseUnit: true, priority: 11 },
  oz: { dimension: "weight", toBase: 28.3495, purchaseUnit: true, priority: 12 },
  bunch: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 13 },
  roll: { dimension: "count", toBase: 1, purchaseUnit: true, priority: 14 },
  l: { dimension: "volume", toBase: 1000, purchaseUnit: true, priority: 15 },
  kg: { dimension: "weight", toBase: 1000, purchaseUnit: true, priority: 16 },
  g: { dimension: "weight", toBase: 1, purchaseUnit: true, priority: 17 },

  // Recipe-measurement units only — never shown in the purchase-quantity
  // dropdown, but still recognized when parsing a recipe ingredient's
  // free-text unit.
  ml: { dimension: "volume", toBase: 1, purchaseUnit: false, priority: 0 },
  tsp: { dimension: "volume", toBase: 4.92892, purchaseUnit: false, priority: 0 },
  tbsp: { dimension: "volume", toBase: 14.7868, purchaseUnit: false, priority: 0 },
  cup: { dimension: "volume", toBase: 236.588, purchaseUnit: false, priority: 0 },
  clove: { dimension: "count", toBase: 1, purchaseUnit: false, priority: 0 },
};

// Explicit synonym/plural lookup — not generic pluralization rules, since
// those get unit abbreviations wrong often enough to not be worth it.
const UNIT_SYNONYMS: Record<string, string> = {
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  kgs: "kg",
  ounce: "oz",
  ounces: "oz",
  ozs: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  teaspoon: "tsp",
  teaspoons: "tsp",
  "tsp.": "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  "tbsp.": "tbsp",
  tbs: "tbsp",
  cups: "cup",
  cans: "can",
  cloves: "clove",
  packages: "package",
  pack: "package",
  packs: "package",
  bunches: "bunch",
  counts: "count",
  bags: "bag",
  boxes: "box",
  jars: "jar",
  bottles: "bottle",
  cartons: "carton",
  rolls: "roll",
  dozens: "dozen",
};

// Vague-but-physically-estimable quantities get a small fixed
// approximation — deterministic constants, not AI guessing, same spirit as
// "a can is always a can." Deliberately excludes "to taste"/"as needed" —
// those aren't a physical amount at all (could be none or a lot, purely
// preferential), so no default is assigned; those stay unparseable and the
// ingredient is always listed, same as today's behavior.
const VAGUE_QUANTITY_APPROXIMATIONS: Record<string, { value: number; unit: string }> = {
  handful: { value: 0.25, unit: "cup" },
  pinch: { value: 1 / 16, unit: "tsp" },
  dash: { value: 1 / 8, unit: "tsp" },
  "a few": { value: 3, unit: "whole" },
  few: { value: 3, unit: "whole" },
};

// For the purchase-quantity <select> (Home Stock's "usual amount to buy,"
// Shopping List quantities) — a fixed, small vocabulary makes a dropdown
// viable in a way free text never could be. Recipe-only measurement units
// are excluded; sorted most- to least-likely to be how something's bought.
export const UNIT_OPTIONS: { value: string; dimension: Dimension }[] = Object.entries(UNIT_DEFS)
  .filter(([, def]) => def.purchaseUnit)
  .sort((a, b) => a[1].priority - b[1].priority)
  .map(([value, def]) => ({ value, dimension: def.dimension }));

export function canonicalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key in UNIT_DEFS) return key;
  if (key in UNIT_SYNONYMS) return UNIT_SYNONYMS[key];
  return null;
}

// Turns a free-text quantity/unit pair into a canonical {value, unit}, or
// null if it can't be confidently parsed. Used to populate
// Ingredient.quantity_value/quantity_unit (AI generation, manual entry,
// import).
export function parseNumericQuantity(
  quantity: string | null | undefined,
  unit: string | null | undefined
): { value: number; unit: string } | null {
  const rawQty = quantity?.trim().toLowerCase() ?? "";

  const vague = VAGUE_QUANTITY_APPROXIMATIONS[rawQty];
  if (vague) return vague;

  const canonicalUnit = canonicalizeUnit(unit);
  if (!canonicalUnit) return null;

  const value = quantity == null ? null : parseQuantity(quantity);
  if (value == null) return null;

  return { value, unit: canonicalUnit };
}
