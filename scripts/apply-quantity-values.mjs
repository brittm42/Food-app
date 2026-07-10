// Applies the output of backfill-quantity-values.mjs to seed-recipes.json
// and the live DB in place. Matches by recipe id (backfill-quantity-values
// reads the live DB directly, so its `id` is the DB row's UUID, not
// seed-recipes.json's own id scheme like "s1" — join by name instead, same
// approach apply-missing-quantities.mjs uses).
// Run with: node --env-file=.env.local scripts/apply-quantity-values.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const backfillPath = path.join(__dirname, "backfill-quantity-values-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-quantity-values.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const backfills = JSON.parse(readFileSync(backfillPath, "utf-8"));
const byName = new Map(backfills.map((b) => [b.name, b]));

let merged = 0;
for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry) continue;
  recipe.ingredients = entry.ingredients;
  merged++;
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged quantity_value/quantity_unit into seed-recipes.json for ${merged} recipe(s).`);

// Update the live DB in place, matching by name (DB uses generated UUIDs,
// not seed-recipes.json's own id scheme). Never delete/reinsert:
// ratings.recipe_id and week_queue.recipe_id both cascade-delete.
let dbUpdated = 0;
let dbFailed = 0;
for (const entry of backfills) {
  const { error, count } = await supabase
    .from("recipes")
    .update({ ingredients: entry.ingredients }, { count: "exact" })
    .eq("id", entry.id);

  if (error) {
    console.error(`DB update failed for "${entry.name}": ${error.message}`);
    dbFailed++;
  } else if (!count) {
    console.warn(`No matching DB row found for id ${entry.id} ("${entry.name}") — skipped.`);
  } else {
    dbUpdated++;
  }
}

console.log(`Updated ${dbUpdated} live DB rows in place (${dbFailed} failed).`);
