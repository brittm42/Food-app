import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const backfillPath = path.join(__dirname, "backfill-servings-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-servings-backfill.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const backfill = JSON.parse(readFileSync(backfillPath, "utf-8"));

// Keyed by name, not id — backfill-servings.mjs reads `id` from the live DB
// (a Postgres UUID), while seed-recipes.json uses its own seed-time id
// scheme (e.g. "f1"). Name is the reliable shared key between the two.
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

  recipe.servings = entry.servings;
  merged++;
}

if (skippedErrors > 0) {
  console.warn(
    `\n${skippedErrors} recipe(s) skipped due to backfill errors — fix and re-run backfill-servings.mjs for those before re-applying.`
  );
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged servings backfill into seed-recipes.json for ${merged} recipe(s).`);

// Update the live DB in place, matching by name (not id). Never
// delete/reinsert: ratings.recipe_id and week_queue.recipe_id both
// cascade-delete, so re-seeding would silently wipe live data.
let dbUpdated = 0;
let dbFailed = 0;
for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry || entry.error) continue;

  const { error, count } = await supabase
    .from("recipes")
    .update({ servings: recipe.servings }, { count: "exact" })
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
