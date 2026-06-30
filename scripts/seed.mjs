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

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));

const rows = seedData.recipes.map((r) => ({
  name: r.name,
  category: r.cat,
  cuisine: r.cuisine || null,
  emoji: r.emoji ?? null,
  hint: r.hint ?? null,
  recipe: r.recipe,
  protein: r.protein ?? null,
  fiber: r.fiber ?? null,
  cal: r.cal ?? null,
  tags: r.tags ?? [],
  ingredients: r.ingredients ?? null,
  is_seed: true,
  user_id: null,
}));

// Clear previously seeded rows first so re-running this script is idempotent.
const { error: deleteError } = await supabase
  .from("recipes")
  .delete()
  .eq("is_seed", true);

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
