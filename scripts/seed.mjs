import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/seed.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

// Mirrors lib/constants.ts's RECIPE_LIBRARY_HOUSEHOLD_ID — kept as a literal
// here since this plain .mjs script runs outside the Next.js build/TS
// pipeline. See supabase/recipes-household-ownership.sql for where this
// reserved household row is created.
const RECIPE_LIBRARY_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));

const rows = seedData.recipes.map((r) => ({
  name: r.name,
  category: r.cat,
  cuisines: r.cuisine ? [r.cuisine] : [],
  dietary_style: r.dietary_style ?? [],
  emoji: r.emoji ?? null,
  hint: r.hint ?? null,
  recipe: r.recipe ?? null,
  steps: r.steps ?? [],
  prep_time_minutes: r.prep_time_minutes ?? null,
  protein: r.protein ?? null,
  fiber: r.fiber ?? null,
  cal: r.cal ?? null,
  tags: r.tags ?? [],
  ingredients: r.ingredients ?? null,
  is_seed: true,
  household_id: RECIPE_LIBRARY_HOUSEHOLD_ID,
  is_public: true,
}));

// Clear previously seeded rows first so re-running this script is
// idempotent. Scoped to the library household so this can never touch a
// real household's own recipes, even if one of them happens to be
// is_seed=true via a future import edge case.
const { error: deleteError } = await supabase
  .from("recipes")
  .delete()
  .eq("is_seed", true)
  .eq("household_id", RECIPE_LIBRARY_HOUSEHOLD_ID);

if (deleteError) {
  console.error("Failed to clear existing seed recipes:", deleteError.message);
  process.exit(1);
}

const { data, error } = await supabase.from("recipes").insert(rows).select("id");

if (error) {
  console.error("Failed to seed recipes:", error.message);
  process.exit(1);
}

console.log(`Seeded ${data.length} recipes.`);
