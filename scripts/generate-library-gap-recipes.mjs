// Computes real meal-type x dietary-style gaps in the seed recipe library
// (floor = 4 matching recipes per combo, only the 4 common styles that have
// real signal: vegetarian/vegan/gluten_free/dairy_free) and generates new
// recipes to fill whatever's under floor — this is what makes the
// onboarding wizard's curation step ("~4 picks per meal type a household
// cares about") reliable even for a restrictive combo like vegan dinners.
//
// Unlike every other script in this repo, this one drafts wholly new
// recipes rather than extracting/classifying existing ones — no prior
// precedent to copy exactly, so it borrows generate-recipe.ts's tool-schema
// shape (mirrored here, not imported — scripts in this repo don't import
// from lib/ or app/, see seed-pantry-items.mjs's comment) and its
// ingredient-naming/category conventions.
//
// Two-phase, same shape as every other backfill in this repo: this script
// only proposes (writes a JSON review file); apply-library-gap-recipes.mjs
// does the actual DB + seed-recipes.json write.
// Run with: node --env-file=.env.local scripts/generate-library-gap-recipes.mjs

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "generate-library-gap-recipes-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey || !supabaseUrl || !secretKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/generate-library-gap-recipes.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-4-6";
const FLOOR = 4;
const DIETARY_STYLE_IDS = ["vegetarian", "vegan", "gluten_free", "dairy_free"];

// Mirrors lib/types.ts's SUB_CATEGORIES/MEAL_TYPES — script-local copy per
// this repo's no-lib-imports-from-scripts convention.
const SUB_CATEGORIES = {
  breakfast: ["oats", "smoothie", "hot", "quick", "guilty"],
  lunch: ["bowls", "wraps", "soups", "lquick"],
  dinner: ["family", "sides"],
  snacks: ["snacks"],
};
const MEAL_TYPES = Object.keys(SUB_CATEGORIES);
function mealTypeForCategory(cat) {
  for (const [meal, subs] of Object.entries(SUB_CATEGORIES)) if (subs.includes(cat)) return meal;
  return "snacks";
}
// The single best-fit sub-category to draft into for each meal type, when
// filling a gap generically (dinner -> "family", the primary main-dish
// category, not "sides" — a gap-filler should read as a real dinner, not a
// side dish).
const PRIMARY_SUB_CATEGORY = { breakfast: "hot", lunch: "bowls", dinner: "family", snacks: "snacks" };

const CUISINE_LABELS = {
  med: "Mediterranean", mex: "Mexican", asi: "Asian", ind: "Indian", ita: "Italian",
  tha: "Thai", chn: "Chinese", jpn: "Japanese", kor: "Korean", viet: "Vietnamese",
  mideast: "Middle Eastern", gre: "Greek", fre: "French", amr: "American",
};
const CUISINE_IDS = Object.keys(CUISINE_LABELS);

const CATEGORIES = [
  "Produce", "Dairy & Eggs", "Meat & Seafood", "Frozen", "Bakery", "Canned Goods",
  "Grains & Dried", "Sauces & Condiments", "Spices", "Beverages", "Snacks",
  "Household & Non-food", "Other",
];

function buildTool(tagNames, knownIngredientNames) {
  return {
    name: "draft_recipe",
    description: "Draft a new structured recipe for the WeeklyNom recipe library, filling a specific content gap.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, appetizing recipe name." },
        cuisine: { type: "string", enum: CUISINE_IDS, description: "The single best-fit cuisine tag." },
        emoji: { type: "string", description: "A single emoji representing the dish." },
        hint: { type: "string", description: "A short, casual one-line description (PRD voice: friendly, brief)." },
        steps: {
          type: "array",
          items: { type: "string" },
          description:
            "Ordered list of instruction steps, one clear action per step. Every ingredient named in a step — including pantry basics like oil, salt, pepper — must also appear as its own entry in the ingredients list.",
        },
        prep_time_minutes: { type: "integer", description: "Estimated active prep time in minutes." },
        servings: { type: "integer", description: "Number of servings this recipe makes." },
        protein: { type: "number", description: "Grams of protein per serving, only if reasonably estimable." },
        fiber: { type: "number", description: "Grams of fiber per serving, only if reasonably estimable." },
        cal: { type: "number", description: "Calories per serving, only if reasonably estimable." },
        tags: {
          type: "array",
          items: { type: "string", enum: tagNames },
          description: "Zero or more existing tags that fit. Only pick from the provided list — never invent a new tag.",
        },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  `Bare ingredient name only — no quantity/brand. Reuse one of these existing names whenever it's the same ingredient: ${knownIngredientNames.join(", ")}.`,
              },
              core: { type: "boolean", description: "true if shelf-stable Core Pantry item, false if Fresh/weekly-buy." },
              category: { type: "string", enum: CATEGORIES, description: "The single best-fit grocery-aisle category." },
              quantity: { type: "string", description: "Amount as it would appear in a recipe. Free text, always a real value." },
              unit: { type: "string", description: 'Unit of measure, e.g. "cup", "tbsp". Omit only if quantity has no unit.' },
            },
            required: ["name", "core", "category", "quantity"],
          },
        },
      },
      required: ["name", "cuisine", "emoji", "hint", "steps", "servings", "tags", "ingredients"],
    },
  };
}

const SYSTEM_PROMPT = (categoryLabel, dietaryStyle, avoidNames) => `You are drafting a brand-new recipe to fill a real content gap in a household recipe library called WeeklyNom. The library's existing recipes share a consistent voice:
- Casual, brief hint lines (not full sentences of marketing copy).
- Protein- and fiber-forward home cooking, simple weeknight-friendly instructions.
- Instructions are an ordered list of discrete steps, one clear action per step.
- Ingredients are split into "Fresh" (perishable) vs "Core" (shelf-stable) with a grocery-aisle category each. Ingredient names are bare nouns, no quantity/brand, reusing an existing name when it's the same ingredient (the Shopping List dedupes by exact name match).

This recipe MUST genuinely satisfy "${dietaryStyle}" as written — ${
  { vegan: "no meat, fish, dairy, eggs, or other animal product anywhere in the ingredients", vegetarian: "no meat or fish", gluten_free: "no wheat, barley, rye, or other gluten-containing ingredients", dairy_free: "no milk, cheese, butter, or other dairy" }[dietaryStyle]
} — this is a hard requirement, not a suggestion. It must fit the "${categoryLabel}" slot in the library (a real ${categoryLabel.toLowerCase()}, not a side dish or snack dressed up as one).

${avoidNames.length ? `Other recipes already being added in this same batch: ${avoidNames.join(", ")}. Make this one genuinely different — a different cuisine and cooking method, not a near-duplicate.` : ""}

Always call the draft_recipe tool with your answer.`;

async function draftRecipe(categoryLabel, dietaryStyle, tagNames, knownIngredientNames, avoidNames) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT(categoryLabel, dietaryStyle, avoidNames),
    tools: [buildTool(tagNames, knownIngredientNames)],
    tool_choice: { type: "tool", name: "draft_recipe" },
    messages: [
      {
        role: "user",
        content: `Draft one ${dietaryStyle.replace("_", "-")} recipe for the "${categoryLabel}" slot.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return a structured recipe.");
  }
  return toolUse.input;
}

const { data: recipes, error } = await supabase.from("recipes").select("id, name, category, dietary_style, ingredients").eq("is_seed", true);
if (error) {
  console.error(error);
  process.exit(1);
}

const counts = {};
for (const m of MEAL_TYPES) { counts[m] = {}; for (const s of DIETARY_STYLE_IDS) counts[m][s] = 0; }
for (const r of recipes) {
  const meal = mealTypeForCategory(r.category);
  if (!MEAL_TYPES.includes(meal)) continue;
  for (const s of DIETARY_STYLE_IDS) if ((r.dietary_style ?? []).includes(s)) counts[meal][s]++;
}

const gaps = [];
for (const meal of MEAL_TYPES) {
  for (const style of DIETARY_STYLE_IDS) {
    const gap = Math.max(0, FLOOR - counts[meal][style]);
    if (gap > 0) gaps.push({ meal, style, have: counts[meal][style], need: gap });
  }
}

console.log("Gap table:", JSON.stringify(gaps, null, 2));
if (gaps.length === 0) {
  console.log("No gaps under the floor of 4 — nothing to generate.");
  process.exit(0);
}

const { data: tagColors } = await supabase.from("tag_colors").select("name");
const tagNames = (tagColors ?? []).map((t) => t.name);
const knownIngredientNames = [
  ...new Set(recipes.flatMap((r) => (r.ingredients ?? []).map((i) => i.name))),
].sort();

const results = [];
for (const { meal, style, need } of gaps) {
  const categoryId = PRIMARY_SUB_CATEGORY[meal];
  const categoryLabel = `${meal[0].toUpperCase()}${meal.slice(1)}`;
  const generatedNamesForCombo = [];
  for (let n = 0; n < need; n++) {
    try {
      const draft = await draftRecipe(categoryLabel, style, tagNames, knownIngredientNames, generatedNamesForCombo);
      generatedNamesForCombo.push(draft.name);
      results.push({
        name: draft.name,
        category: categoryId,
        cuisines: [draft.cuisine],
        dietary_style: [style],
        emoji: draft.emoji,
        hint: draft.hint,
        steps: draft.steps,
        prep_time_minutes: draft.prep_time_minutes ?? null,
        servings: draft.servings ?? null,
        protein: draft.protein ?? null,
        fiber: draft.fiber ?? null,
        cal: draft.cal ?? null,
        tags: draft.tags ?? [],
        ingredients: draft.ingredients,
        gap_meal: meal,
        gap_style: style,
      });
      console.log(`Generated "${draft.name}" for ${meal} x ${style} (${n + 1}/${need})`);
    } catch (err) {
      console.error(`Failed to generate for ${meal} x ${style}: ${err.message}`);
    }
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `\nGenerated ${results.length} new recipe(s).\n` +
    `Wrote ${outputPath}. Review, then run: node --env-file=.env.local scripts/apply-library-gap-recipes.mjs`
);
