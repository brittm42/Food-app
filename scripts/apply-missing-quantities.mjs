import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const fillPath = path.join(__dirname, "fill-missing-quantities-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-missing-quantities.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const fills = JSON.parse(readFileSync(fillPath, "utf-8"));

// Keyed by name, not id — fill-missing-quantities.mjs read the live DB
// directly, so its `id` is the DB row's UUID, not seed-recipes.json's own
// id scheme (e.g. "f1"). Name is the reliable shared key between the two.
const byName = new Map(fills.map((f) => [f.name, f]));

let skippedErrors = 0;
let merged = 0;

for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry) continue;
  if (entry.error) {
    console.warn(`Skipping ${recipe.id} (${recipe.name}) — fill had an error: ${entry.error}`);
    skippedErrors++;
    continue;
  }

  const filledByName = new Map((entry.filled ?? []).map((i) => [i.name, i]));
  recipe.ingredients = (recipe.ingredients ?? []).map((ing) => {
    if (ing.quantity && ing.quantity.trim() !== "") return ing; // already had one — leave untouched
    const fill = filledByName.get(ing.name);
    if (!fill) return ing; // AI didn't return this one — leave as-is rather than guessing here
    return { ...ing, quantity: fill.quantity ?? null, unit: fill.unit ?? null };
  });

  merged++;
}

if (skippedErrors > 0) {
  console.warn(
    `\n${skippedErrors} recipe(s) skipped due to fill errors — fix and re-run fill-missing-quantities.mjs for those before re-applying.`
  );
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged quantity fills into seed-recipes.json for ${merged} recipe(s).`);

// Update the live DB in place, matching by name (not id — DB uses generated
// UUIDs). Never delete/reinsert: ratings.recipe_id and week_queue.recipe_id
// both cascade-delete, so going through seed.mjs's delete+reinsert would
// silently wipe live ratings/This-Week data.
let dbUpdated = 0;
let dbFailed = 0;
for (const recipe of seedData.recipes) {
  const entry = byName.get(recipe.name);
  if (!entry || entry.error) continue;

  const { error, count } = await supabase
    .from("recipes")
    .update({ ingredients: recipe.ingredients }, { count: "exact" })
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
