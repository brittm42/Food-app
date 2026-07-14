// Classifies each of the 41 seed recipes against the 4 dietary styles that
// have real signal for this household (vegetarian/vegan/gluten_free/
// dairy_free — pescatarian/keto/low_carb/paleo/kosher/halal are skipped,
// no one's ever selected them and forcing a classification would be noise).
// One Claude call per recipe, same "read name/ingredients/tags, judge from
// what's actually in the dish" shape as backfill-ingredient-categories.mjs.
//
// Two-phase, same shape as every other backfill in this repo: this script
// only proposes (writes a JSON review file); apply-recipe-dietary-style.mjs
// does the actual DB + seed-recipes.json write.
// Run with: node --env-file=.env.local scripts/backfill-recipe-dietary-style.mjs

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "backfill-recipe-dietary-style-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey || !supabaseUrl || !secretKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/backfill-recipe-dietary-style.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-5";

// Mirrors lib/types.ts's DIETARY_STYLES ids — scripts in this repo don't
// import from lib/ (see seed-pantry-items.mjs's comment on the same
// constraint), so kept as a script-local copy. Deliberately just the 4 with
// real signal, not the full 10-entry DIETARY_STYLES set.
const DIETARY_STYLE_IDS = ["vegetarian", "vegan", "gluten_free", "dairy_free"];

const TOOL = {
  name: "classify_dietary_style",
  description: "Classify which dietary styles a recipe genuinely satisfies as written.",
  input_schema: {
    type: "object",
    properties: {
      dietary_style: {
        type: "array",
        items: { type: "string", enum: DIETARY_STYLE_IDS },
        description:
          "Zero or more styles this recipe truly satisfies (e.g. only \"vegan\" if there is no meat, fish, dairy, eggs, or other animal product anywhere in the ingredients — not just \"probably fine\"). Empty array if none apply.",
      },
    },
    required: ["dietary_style"],
  },
};

const SYSTEM_PROMPT = `You are classifying an existing recipe from a household recipe library called WeeklyNom against a fixed set of dietary styles, based on its actual ingredient list. Be strict: only include a style if the recipe as written genuinely satisfies it, not "close enough" or "could be adapted." Always call the classify_dietary_style tool with your answer.`;

async function classify(recipe) {
  const ingredientNames = (recipe.ingredients ?? []).map((i) => i.name);
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "classify_dietary_style" },
    messages: [
      {
        role: "user",
        content: `Recipe: ${recipe.name}\nTags: ${(recipe.tags ?? []).join(", ") || "(none)"}\nIngredients:\n${ingredientNames.map((n) => `- ${n}`).join("\n")}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return structured output.");
  }
  let value = toolUse.input.dietary_style;
  // Defensive: occasionally comes back as a JSON-encoded string
  // ('{"dietary_style": [...]}' ) instead of a real array — unwrap it
  // rather than let a downstream .join() throw.
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      value = Array.isArray(parsed) ? parsed : parsed.dietary_style;
    } catch {
      value = [];
    }
  }
  return Array.isArray(value) ? value : [];
}

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, tags, ingredients")
  .eq("is_seed", true)
  .order("name");

if (error) {
  console.error(error);
  process.exit(1);
}

const results = [];
let i = 0;
for (const recipe of recipes) {
  i++;
  try {
    const dietary_style = await classify(recipe);
    results.push({ id: recipe.id, name: recipe.name, dietary_style });
    console.log(`[${i}/${recipes.length}] ${recipe.name} -> ${dietary_style.join(", ") || "(none)"}`);
  } catch (err) {
    console.error(`Failed ${recipe.name}: ${err.message}`);
    results.push({ id: recipe.id, name: recipe.name, error: err.message });
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `\nClassified ${results.length} recipe(s).\n` +
    `Wrote ${outputPath}. Review, then run: node --env-file=.env.local scripts/apply-recipe-dietary-style.mjs`
);
