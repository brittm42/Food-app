// Merges backfill-recipe-dietary-style-output.json into seed-recipes.json
// and updates the live DB rows in place, matching by name (seed-recipes.json
// uses its own seed-time id scheme, not the DB's UUIDs) and scoped to
// is_seed = true, since the backfill only ever classified seed recipes.
// Never delete/reinsert: ratings.recipe_id and week_queue.recipe_id both
// cascade-delete on the recipes table.
// Run with: node --env-file=.env.local scripts/apply-recipe-dietary-style.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const backfillPath = path.join(__dirname, "backfill-recipe-dietary-style-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-recipe-dietary-style.mjs"
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

  recipe.dietary_style = entry.dietary_style ?? [];
  merged++;
}

if (skippedErrors > 0) {
  console.warn(
    `\n${skippedErrors} recipe(s) skipped due to backfill errors — fix and re-run backfill-recipe-dietary-style.mjs for those before re-applying.`
  );
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged dietary-style backfill into seed-recipes.json for ${merged} recipe(s).`);

let dbUpdated = 0;
let dbFailed = 0;
for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry || entry.error) continue;

  const { error, count } = await supabase
    .from("recipes")
    .update({ dietary_style: recipe.dietary_style }, { count: "exact" })
    .eq("is_seed", true)
    .eq("name", recipe.name);

  if (error) {
    console.error(`DB update failed for "${recipe.name}": ${error.message}`);
    dbFailed++;
  } else if (!count) {
    console.warn(`No matching seed row found in DB for "${recipe.name}" — skipped.`);
  } else {
    dbUpdated++;
  }
}

console.log(`Updated ${dbUpdated} live DB rows in place (${dbFailed} failed).`);
