// Backfills Ingredient.category (lib/categories.ts's grocery-aisle
// taxonomy) onto every existing recipe's ingredients, so the Shopping
// List's recipe-driven "Buy Fresh" section (app/shopping/page.tsx) can
// group by aisle the same way Kitchen/Pantry already does. One Claude call
// per recipe (categorizing all its ingredients at once) rather than one
// call per ingredient — cheaper and faster than reusing lib/categorize.ts's
// single-item categorizeItem per name.
//
// Two-phase, same shape as backfill-servings.mjs: this script only
// proposes (writes a JSON review file); apply-ingredient-categories.mjs
// does the actual DB + seed-recipes.json write.
// Run with: node --env-file=.env.local scripts/backfill-ingredient-categories.mjs

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "backfill-ingredient-categories-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey || !supabaseUrl || !secretKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/backfill-ingredient-categories.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-5";

// Mirrors lib/categories.ts's CATEGORIES — kept as a script-local copy
// since scripts in this repo don't import from lib/ (see
// seed-pantry-items.mjs's comment on the same constraint).
const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Frozen",
  "Bakery",
  "Canned Goods",
  "Grains & Dried",
  "Sauces & Condiments",
  "Spices",
  "Beverages",
  "Snacks",
  "Household & Non-food",
  "Other",
];

const TOOL = {
  name: "categorize_ingredients",
  description: "Assign the single best-fit grocery-aisle category to each ingredient in a recipe.",
  input_schema: {
    type: "object",
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: CATEGORIES },
          },
          required: ["name", "category"],
        },
      },
    },
    required: ["ingredients"],
  },
};

const SYSTEM_PROMPT = `You are assigning a grocery-aisle category to each ingredient in a recipe from a household recipe library called WeeklyNom. Return exactly one category per ingredient, in the same order given, from the fixed category list. Always call the categorize_ingredients tool with your answer.`;

async function categorizeIngredients(recipe, names) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "categorize_ingredients" },
    messages: [
      {
        role: "user",
        content: `Recipe: ${recipe.name}\n\nIngredients:\n${names.map((n) => `- ${n}`).join("\n")}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return structured output.");
  }
  return toolUse.input.ingredients;
}

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, ingredients")
  .order("name");

if (error) {
  console.error(error);
  process.exit(1);
}

const results = [];
let i = 0;
for (const recipe of recipes) {
  const missing = (recipe.ingredients ?? []).filter((ing) => !ing.category);
  if (missing.length === 0) continue;

  i++;
  try {
    const categorized = await categorizeIngredients(recipe, missing.map((ing) => ing.name));
    const categoryByName = new Map(categorized.map((c) => [c.name, c.category]));
    const ingredients = (recipe.ingredients ?? []).map((ing) =>
      ing.category ? ing : { ...ing, category: categoryByName.get(ing.name) ?? "Other" }
    );
    results.push({ id: recipe.id, name: recipe.name, ingredients });
    console.log(`[${i}] ${recipe.name} -> ${missing.length} ingredient(s) categorized`);
  } catch (err) {
    console.error(`Failed ${recipe.name}: ${err.message}`);
    results.push({ id: recipe.id, name: recipe.name, error: err.message });
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `\nProcessed ${results.length} recipe(s) with at least one uncategorized ingredient.\n` +
    `Wrote ${outputPath}. Review, then run: node --env-file=.env.local scripts/apply-ingredient-categories.mjs`
);
