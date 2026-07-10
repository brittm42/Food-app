// Backfills Ingredient.quantity_value/quantity_unit onto every existing
// recipe's `core: true` ingredients, so pantry reconciliation
// (app/shopping/page.tsx) has something to work with on recipes that
// predate this feature. Purely deterministic parsing — no AI, no guessing
// for genuinely unparseable quantities ("handful", "to taste") — mirrors
// lib/units.ts exactly. Kept as a script-local copy rather than importing
// lib/units.ts directly: Node's native TS support can't resolve that
// module's own extensionless internal import of ./scale-quantity, and no
// other script in this repo imports from lib/ either. Keep this in sync
// with lib/units.ts by hand if that file changes.
//
// Two-phase, same shape as fill-missing-quantities.mjs/apply-missing-
// quantities.mjs: this script only proposes (writes a JSON review file);
// apply-quantity-values.mjs does the actual DB + seed-recipes.json write.
// Run with: node --env-file=.env.local scripts/backfill-quantity-values.mjs

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "backfill-quantity-values-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/backfill-quantity-values.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

// --- mirrors lib/units.ts ---

const UNIT_DEFS = {
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

const UNIT_SYNONYMS = {
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg", kgs: "kg",
  ounce: "oz", ounces: "oz", ozs: "oz",
  pound: "lb", pounds: "lb", lbs: "lb",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  teaspoon: "tsp", teaspoons: "tsp", "tsp.": "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp", "tbsp.": "tbsp", tbs: "tbsp",
  cups: "cup",
  cans: "can",
  cloves: "clove",
  packages: "package", pack: "package", packs: "package",
  bunches: "bunch",
};

const VAGUE_QUANTITY_APPROXIMATIONS = {
  handful: { value: 0.25, unit: "cup" },
  pinch: { value: 1 / 16, unit: "tsp" },
  dash: { value: 1 / 8, unit: "tsp" },
  "a few": { value: 3, unit: "whole" },
  few: { value: 3, unit: "whole" },
};

function parseSimpleNumber(token) {
  const trimmed = token.trim();
  if (/^\d+\/\d+$/.test(trimmed)) {
    const [n, d] = trimmed.split("/").map(Number);
    return d === 0 ? null : n / d;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  return null;
}

function parseQuantity(raw) {
  const trimmed = raw.trim();
  const mixed = trimmed.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixed) {
    const whole = parseSimpleNumber(mixed[1]);
    const frac = parseSimpleNumber(mixed[2]);
    return whole != null && frac != null ? whole + frac : null;
  }
  return parseSimpleNumber(trimmed);
}

function canonicalizeUnit(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key in UNIT_DEFS) return key;
  if (key in UNIT_SYNONYMS) return UNIT_SYNONYMS[key];
  return null;
}

function parseNumericQuantity(quantity, unit) {
  const rawQty = quantity?.trim().toLowerCase() ?? "";
  const vague = VAGUE_QUANTITY_APPROXIMATIONS[rawQty];
  if (vague) return vague;

  const canonicalUnit = canonicalizeUnit(unit);
  if (!canonicalUnit) return null;

  const value = quantity == null ? null : parseQuantity(quantity);
  if (value == null) return null;

  return { value, unit: canonicalUnit };
}

// --- end mirror ---

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, ingredients")
  .order("name");

if (error) {
  console.error(error);
  process.exit(1);
}

const results = [];
let touched = 0;
let untouched = 0;
let parsedCount = 0;
let unparsedCount = 0;

for (const recipe of recipes) {
  const coreIngredients = (recipe.ingredients ?? []).filter((i) => i.core);
  if (coreIngredients.length === 0) {
    untouched++;
    continue;
  }

  const ingredients = (recipe.ingredients ?? []).map((ing) => {
    if (!ing.core) return ing;
    const parsed = parseNumericQuantity(ing.quantity, ing.unit);
    if (parsed) parsedCount++;
    else unparsedCount++;
    return { ...ing, quantity_value: parsed?.value ?? null, quantity_unit: parsed?.unit ?? null };
  });

  touched++;
  results.push({ id: recipe.id, name: recipe.name, ingredients });
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `Parsed ${touched} recipe(s) with core ingredients (${untouched} had none, skipped). ` +
    `${parsedCount} core ingredient(s) got a numeric quantity_value/quantity_unit, ${unparsedCount} stayed unparseable (left null — always listed, same as today).\n` +
    `Wrote ${outputPath}. Review, then run: node --env-file=.env.local scripts/apply-quantity-values.mjs`
);
