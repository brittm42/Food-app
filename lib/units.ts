// Bounded, deterministic unit handling for pantry reconciliation (Shopping
// List vs. on-hand quantities). Three closed dimensions, no cross-dimension
// conversion (e.g. never weight <-> volume, which needs ingredient density
// and can't be done generally) — anything outside this vocabulary, or a
// needed/on-hand pair in mismatched dimensions, is left "unknown" so the
// caller can fail open (keep listing the item) rather than invent false
// confidence.

import { parseQuantity } from "./scale-quantity";

type Dimension = "weight" | "volume" | "count";

type UnitDef = { dimension: Dimension; toBase: number };

// Weight base unit: grams. Volume base unit: milliliters. Count units have
// no real conversion factor — each one only reconciles against the exact
// same unit string (a "can" is never compared to a "clove").
const UNIT_DEFS: Record<string, UnitDef> = {
  g: { dimension: "weight", toBase: 1 },
  kg: { dimension: "weight", toBase: 1000 },
  oz: { dimension: "weight", toBase: 28.3495 },
  lb: { dimension: "weight", toBase: 453.592 },

  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
  tsp: { dimension: "volume", toBase: 4.92892 },
  tbsp: { dimension: "volume", toBase: 14.7868 },
  cup: { dimension: "volume", toBase: 236.588 },

  can: { dimension: "count", toBase: 1 },
  clove: { dimension: "count", toBase: 1 },
  whole: { dimension: "count", toBase: 1 },
  package: { dimension: "count", toBase: 1 },
  bunch: { dimension: "count", toBase: 1 },
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

// For a unit <select> in the Pantry on-hand UI — a fixed, small vocabulary
// makes a dropdown viable in a way free text never could be.
export const UNIT_OPTIONS: { value: string; dimension: Dimension }[] = Object.entries(UNIT_DEFS).map(
  ([value, def]) => ({ value, dimension: def.dimension })
);

export function canonicalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key in UNIT_DEFS) return key;
  if (key in UNIT_SYNONYMS) return UNIT_SYNONYMS[key];
  return null;
}

// Turns a free-text quantity/unit pair into a canonical {value, unit}, or
// null if it can't be confidently parsed. Used both to populate
// Ingredient.quantity_value/quantity_unit and to interpret pantry_on_hand
// rows entered through the UI.
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

export type ReconcileResult = "have-enough" | "need-more" | "unknown";

// Compares what's needed against what's on hand. Fails open ("unknown") on
// anything ambiguous — missing data, incompatible units, mismatched
// dimensions — so the caller always defaults to still listing the item
// rather than silently hiding something that might actually be needed.
export function reconcile(
  neededValue: number | null,
  neededUnit: string | null,
  onHandValue: number | null,
  onHandUnit: string | null
): ReconcileResult {
  if (neededValue == null || neededUnit == null) return "unknown";

  const neededDef = UNIT_DEFS[neededUnit];
  if (!neededDef) return "unknown";

  if (onHandValue == null || onHandUnit == null) return "need-more";

  const onHandDef = UNIT_DEFS[onHandUnit];
  if (!onHandDef || onHandDef.dimension !== neededDef.dimension) return "unknown";

  if (neededDef.dimension === "count" && neededUnit !== onHandUnit) return "unknown";

  const neededBase = neededValue * neededDef.toBase;
  const onHandBase = onHandValue * onHandDef.toBase;
  return onHandBase >= neededBase ? "have-enough" : "need-more";
}
