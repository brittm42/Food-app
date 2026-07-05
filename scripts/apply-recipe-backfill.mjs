import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const backfillPath = path.join(__dirname, "backfill-output.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/apply-recipe-backfill.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const backfill = JSON.parse(readFileSync(backfillPath, "utf-8"));

const byId = new Map(backfill.map((b) => [b.id, b]));

let skippedErrors = 0;
let merged = 0;

for (const recipe of seedData.recipes) {
  const entry = byId.get(recipe.id);
  if (!entry) continue;
  if (entry.error) {
    console.warn(`Skipping ${recipe.id} (${recipe.name}) — backfill had an error: ${entry.error}`);
    skippedErrors++;
    continue;
  }

  recipe.steps = entry.steps ?? [];
  if (entry.prep_time_minutes != null) recipe.prep_time_minutes = entry.prep_time_minutes;

  const qtyByName = new Map((entry.ingredients ?? []).map((i) => [i.name, i]));
  recipe.ingredients = (recipe.ingredients ?? []).map((ing) => {
    const match = qtyByName.get(ing.name);
    return {
      ...ing,
      quantity: match?.quantity ?? null,
      unit: match?.unit ?? null,
    };
  });

  merged++;
}

if (skippedErrors > 0) {
  console.warn(
    `\n${skippedErrors} recipe(s) skipped due to backfill errors — fix and re-run backfill-recipe-content.mjs for those before re-applying.`
  );
}

writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + "\n");
console.log(`Merged backfill into seed-recipes.json for ${merged} recipes.`);

// Update the live DB in place, matching by name (not id — DB uses generated
// UUIDs). Never delete/reinsert here: ratings.recipe_id and
// week_queue.recipe_id both cascade-delete, so going through seed.mjs's
// delete+reinsert would silently wipe live ratings/This-Week data.
let dbUpdated = 0;
let dbFailed = 0;
for (const recipe of seedData.recipes) {
  const entry = byId.get(recipe.id);
  if (!entry || entry.error) continue;

  const { error, count } = await supabase
    .from("recipes")
    .update(
      {
        steps: recipe.steps,
        prep_time_minutes: recipe.prep_time_minutes ?? null,
        ingredients: recipe.ingredients,
      },
      { count: "exact" }
    )
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
