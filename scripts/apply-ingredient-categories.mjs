// Merges backfill-ingredient-categories-output.json into seed-recipes.json
// (matching by name, since seed-recipes.json uses its own seed-time id
// scheme rather than the live DB's UUIDs) and updates every affected live
// DB row directly by id — unlike the servings/content backfills, this one
// isn't seed-only (any non-seed recipe, e.g. AI-generated or manually
// added, can also have uncategorized ingredients), so seed-recipes.json
// can't be used as the DB-update driver the way earlier apply scripts did.
// Never delete/reinsert: ratings.recipe_id and week_queue.recipe_id both
// cascade-delete on the recipes table.
// Run with: node --env-file=.env.local scripts/apply-ingredient-categories.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const backfillPath = path.join(__dirname, "backfill-ingredient-categories-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-ingredient-categories.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const backfill = JSON.parse(readFileSync(backfillPath, "utf-8"));

const byName = new Map(backfill.map((b) => [b.name, b]));

let skippedErrors = 0;
let merged = 0;

for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry) continue;
  if (entry.error) {
    console.warn(`Skipping ${recipe.name} — backfill had an error: ${entry.error}`);
    skippedErrors++;
    continue;
  }

  const categoryByName = new Map((entry.ingredients ?? []).map((i) => [i.name, i.category]));
  recipe.ingredients = (recipe.ingredients ?? []).map((ing) => ({
    ...ing,
    category: ing.category ?? categoryByName.get(ing.name) ?? null,
  }));

  merged++;
}

if (skippedErrors > 0) {
  console.warn(
    `\n${skippedErrors} recipe(s) skipped due to backfill errors — fix and re-run backfill-ingredient-categories.mjs for those before re-applying.`
  );
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged ingredient-category backfill into seed-recipes.json for ${merged} recipe(s).`);

// Update every backfilled recipe in the live DB directly by id (not just
// the ones present in seed-recipes.json) — the backfill script queries all
// recipes, seed or not, so this must too.
let dbUpdated = 0;
let dbFailed = 0;
for (const entry of backfill) {
  if (entry.error) continue;

  const { error, count } = await supabase
    .from("recipes")
    .update({ ingredients: entry.ingredients }, { count: "exact" })
    .eq("id", entry.id);

  if (error) {
    console.error(`DB update failed for "${entry.name}": ${error.message}`);
    dbFailed++;
  } else if (!count) {
    console.warn(`No matching row found in DB for "${entry.name}" (id ${entry.id}) — skipped.`);
  } else {
    dbUpdated++;
  }
}

console.log(`Updated ${dbUpdated} live DB rows in place (${dbFailed} failed).`);
