// Extends generate-library-gap-recipes.mjs's meal-type x dietary-style gap
// analysis with a second dimension: common allergens hard-excluded (the
// same ingredient-substring exclusion onboarding.ts's curateStarterRecipes
// applies for a strict_avoidance allergy via lib/allergens.ts). A combo can
// clear the dietary-style floor and still be thin once a real household's
// allergy is layered on top — e.g. dinner x vegan drops from 4 to 3 once you
// also exclude soy. Floor stays 4, matching the original script; redundant
// pairs (a dietary style that already implies avoiding an allergen, e.g.
// vegan+dairy) are skipped.
//
// Same two-phase shape as every backfill in this repo: this only proposes
// (writes to generate-library-gap-recipes-output.json, the SAME file
// generate-library-gap-recipes.mjs uses) so the existing
// apply-library-gap-recipes.mjs can insert it unchanged — no new apply
// script needed.
// Run with: node --env-file=.env.local scripts/generate-allergen-safe-gap-recipes.mjs

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
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/generate-allergen-safe-gap-recipes.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-4-6";
const FLOOR = 4;
const DIETARY_STYLE_IDS = ["vegetarian", "vegan", "gluten_free", "dairy_free"];
const ALLERGENS = ["peanut", "tree nut", "egg", "dairy", "shellfish", "soy", "wheat", "fish", "sesame"];
// A dietary style that already implies avoiding this allergen -- skip the
// pair, it can't produce a real gap.
const REDUNDANT = {
  vegan: ["egg", "dairy", "shellfish", "fish"],
  vegetarian: ["shellfish", "fish"],
  gluten_free: ["wheat"],
  dairy_free: ["dairy"],
};

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

const DIETARY_STYLE_RULE = {
  vegan: "no meat, fish, dairy, eggs, or other animal product anywhere in the ingredients",
  vegetarian: "no meat or fish",
  gluten_free: "no wheat, barley, rye, or other gluten-containing ingredients",
  dairy_free: "no milk, cheese, butter, or other dairy",
};
const ALLERGEN_RULE = {
  peanut: "no peanuts or peanut-derived ingredients (peanut butter, peanut oil, etc.)",
  "tree nut": "no tree nuts or tree-nut-derived ingredients (almond, cashew, walnut, pecan, pistachio, hazelnut, almond/cashew milk or butter, etc.)",
  egg: "no eggs or egg-derived ingredients (mayonnaise, meringue, etc.)",
  dairy: "no milk, cheese, butter, yogurt, or other dairy",
  shellfish: "no shrimp, crab, lobster, or other shellfish",
  soy: "no soy, soy sauce, tofu, edamame, or other soy-derived ingredients",
  wheat: "no wheat or wheat-derived ingredients",
  fish: "no fish or fish-derived ingredients (fish sauce, anchovy, etc.)",
  sesame: "no sesame seeds, sesame oil, or tahini",
};

const SYSTEM_PROMPT = (categoryLabel, dietaryStyle, avoidAllergens, avoidNames) => `You are drafting a brand-new recipe to fill a real content gap in a household recipe library called WeeklyNom. The library's existing recipes share a consistent voice:
- Casual, brief hint lines (not full sentences of marketing copy).
- Protein- and fiber-forward home cooking, simple weeknight-friendly instructions.
- Instructions are an ordered list of discrete steps, one clear action per step.
- Ingredients are split into "Fresh" (perishable) vs "Core" (shelf-stable) with a grocery-aisle category each. Ingredient names are bare nouns, no quantity/brand, reusing an existing name when it's the same ingredient (the Shopping List dedupes by exact name match).

This recipe MUST genuinely satisfy "${dietaryStyle}" as written — ${DIETARY_STYLE_RULE[dietaryStyle]} — this is a hard requirement, not a suggestion.

It must ALSO be genuinely safe for someone with the following allergies — ${avoidAllergens.map((a) => ALLERGEN_RULE[a]).join("; ")} — also a hard requirement. Double-check every ingredient against both the dietary style and every allergen listed before finalizing; a recipe drafted for "vegan" or "gluten_free" is not automatically safe for these allergens (e.g. a vegan recipe can still contain soy or sesame, a gluten_free recipe can still contain egg).

It must fit the "${categoryLabel}" slot in the library (a real ${categoryLabel.toLowerCase()}, not a side dish or snack dressed up as one).

${avoidNames.length ? `Other recipes already being added in this same batch: ${avoidNames.join(", ")}. Make this one genuinely different — a different cuisine and cooking method, not a near-duplicate.` : ""}

Always call the draft_recipe tool with your answer.`;

async function draftRecipe(categoryLabel, dietaryStyle, avoidAllergens, tagNames, knownIngredientNames, avoidNames) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT(categoryLabel, dietaryStyle, avoidAllergens, avoidNames),
    tools: [buildTool(tagNames, knownIngredientNames)],
    tool_choice: { type: "tool", name: "draft_recipe" },
    messages: [
      {
        role: "user",
        content: `Draft one ${dietaryStyle.replace("_", "-")} recipe for the "${categoryLabel}" slot, safe for someone allergic to ${avoidAllergens.join(" and ")}.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return a structured recipe.");
  }
  return toolUse.input;
}

// Post-hoc safety check on the AI's own output, same spirit as Phase B
// catching a mistagged vegan-with-honey recipe — naive substring match
// against the same stems onboarding's flagAllergensInRecipe uses.
function singularize(w) { return w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w; }
function violatesAllergen(ingredients, allergen) {
  const stem = singularize(allergen);
  return (ingredients ?? []).some((i) => (i.name ?? "").toLowerCase().includes(stem));
}

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, category, dietary_style, ingredients")
  .eq("is_public", true);
if (error) {
  console.error(error);
  process.exit(1);
}

const gaps = [];
for (const meal of MEAL_TYPES) {
  for (const style of DIETARY_STYLE_IDS) {
    const needs = {};
    for (const allergen of ALLERGENS) {
      if (REDUNDANT[style]?.includes(allergen)) continue;
      const have = recipes.filter(
        (r) =>
          mealTypeForCategory(r.category) === meal &&
          (r.dietary_style ?? []).includes(style) &&
          !violatesAllergen(r.ingredients, allergen)
      ).length;
      if (have < FLOOR) needs[allergen] = FLOOR - have;
    }
    // Greedy pairing, max 2 allergens per recipe (only matters if a combo
    // needs more than one recipe -- at floor 4 today's real gaps are all
    // need=1, so this is mostly a no-op safety net for re-runs later).
    while (Object.values(needs).some((n) => n > 0)) {
      const sorted = Object.entries(needs).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) break;
      const [a] = sorted;
      const b = sorted[1];
      const avoidSet = b ? [a[0], b[0]] : [a[0]];
      for (const key of avoidSet) needs[key]--;
      gaps.push({ meal, style, avoidAllergens: avoidSet });
    }
  }
}

console.log(`Allergen-aware gaps at floor ${FLOOR}: ${gaps.length}`);
console.log(gaps.map((g) => `${g.meal} x ${g.style} (avoid ${g.avoidAllergens.join("+")})`).join("\n"));
if (gaps.length === 0) {
  console.log("No allergen-compounded gaps under the floor of 4 — nothing to generate.");
  process.exit(0);
}

const { data: tagColors } = await supabase.from("tag_colors").select("name");
const tagNames = (tagColors ?? []).map((t) => t.name);
const knownIngredientNames = [
  ...new Set(recipes.flatMap((r) => (r.ingredients ?? []).map((i) => i.name))),
].sort();

const results = [];
const generatedNames = [];
for (const { meal, style, avoidAllergens } of gaps) {
  const categoryId = PRIMARY_SUB_CATEGORY[meal];
  const categoryLabel = `${meal[0].toUpperCase()}${meal.slice(1)}`;
  try {
    const draft = await draftRecipe(categoryLabel, style, avoidAllergens, tagNames, knownIngredientNames, generatedNames);
    generatedNames.push(draft.name);

    const violations = avoidAllergens.filter((a) => violatesAllergen(draft.ingredients, a));
    if (violations.length) {
      console.warn(
        `WARNING: "${draft.name}" (${meal} x ${style}) still contains an ingredient matching: ${violations.join(", ")} — flagging for manual review, not auto-fixing.`
      );
    }

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
      gap_avoid_allergens: avoidAllergens,
      allergen_check_violations: violations,
    });
    console.log(`Generated "${draft.name}" for ${meal} x ${style} (avoid ${avoidAllergens.join("+")})${violations.length ? " -- HAS VIOLATIONS, see warning above" : ""}`);
  } catch (err) {
    console.error(`Failed to generate for ${meal} x ${style}: ${err.message}`);
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `\nGenerated ${results.length} new recipe(s).\n` +
    `Wrote ${outputPath} (same file generate-library-gap-recipes.mjs uses). Review, then run: node --env-file=.env.local scripts/apply-library-gap-recipes.mjs`
);
