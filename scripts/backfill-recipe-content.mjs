import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "seed-recipes.json");
const outputPath = path.join(__dirname, "backfill-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY. Run with: node --env-file=.env.local scripts/backfill-recipe-content.mjs"
  );
  process.exit(1);
}

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const seedData = JSON.parse(readFileSync(seedPath, "utf-8"));
const recipes = limit ? seedData.recipes.slice(0, limit) : seedData.recipes;

const client = new Anthropic({ apiKey });

const TOOL = {
  name: "backfill_recipe_content",
  description:
    "Extract structured step-by-step instructions, ingredient quantities/units, and a prep time estimate from an existing recipe's freeform prose.",
  input_schema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        items: { type: "string" },
        description:
          "Ordered list of instruction steps extracted/derived from the prose, one clear action per step. Preserve any <strong> emphasis on the same phrases where reasonable. Do not invent steps not implied by the prose.",
      },
      prep_time_minutes: {
        type: "integer",
        description:
          "Estimated active prep time in minutes, only if there's a reasonable basis from the steps/ingredients. Omit if you'd just be guessing.",
      },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Must exactly match one of the existing ingredient names provided in the prompt. Do not rename.",
            },
            core: { type: "boolean", description: "Echo back the existing core value unchanged." },
            quantity: {
              type: "string",
              description:
                'Amount as it appears/is implied in the prose, e.g. "1", "1/2", "2-3", "handful", "to taste". Extract from the prose when present rather than inventing a new value. Omit if genuinely not quantifiable.',
            },
            unit: {
              type: "string",
              description: 'Unit of measure, e.g. "cup", "tbsp", "clove", "can", "whole". Omit if quantity has no unit.',
            },
          },
          required: ["name", "core"],
        },
        description:
          "Same ingredients as provided, in the same order, each annotated with quantity/unit extracted from the prose.",
      },
    },
    required: ["steps", "ingredients"],
  },
};

const SYSTEM_PROMPT = `You are backfilling structured content onto existing recipes in a household recipe library called WeeklyNom. You are NOT drafting a new recipe — you are extracting structure from prose that already describes a real recipe. Rules:
- Split the existing prose instructions into an ordered list of discrete steps (one action per step), preserving the original wording and any <strong> emphasis as closely as reasonable rather than rewriting the recipe's voice.
- For each existing ingredient (name/core given), find its quantity as stated or clearly implied in the prose (e.g. "1 cup frozen wild blueberries" -> quantity "1", unit "cup" for the "Frozen wild blueberries" ingredient) and attach it. Do not invent a quantity that isn't in the prose; omit quantity/unit if the prose doesn't specify one for that ingredient.
- Never rename an ingredient or change its core/fresh flag — echo them back exactly as given, only adding quantity/unit.
- Estimate prep_time_minutes only when the steps/ingredients give a reasonable basis (e.g. a blender recipe with 5 ingredients is quick; a soup with multiple cooking steps takes longer). Omit rather than guess wildly.
Always call the backfill_recipe_content tool with your answer.`;

function buildPrompt(recipe) {
  const ingredientList = (recipe.ingredients ?? [])
    .map((i) => `- ${i.name} (core: ${i.core})`)
    .join("\n");
  return `Recipe name: ${recipe.name}
Hint: ${recipe.hint ?? ""}
Existing prose instructions: ${recipe.recipe ?? "(none)"}

Existing ingredients (extract quantity/unit for each from the prose above; do not rename):
${ingredientList || "(none)"}`;
}

async function backfillOne(recipe) {
  if (!recipe.recipe && (!recipe.ingredients || recipe.ingredients.length === 0)) {
    // e.g. "Cinnamon Rolls" — no prose, no ingredients to annotate.
    return { id: recipe.id, name: recipe.name, steps: [], prep_time_minutes: null, ingredients: [] };
  }
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "backfill_recipe_content" },
    messages: [{ role: "user", content: buildPrompt(recipe) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return structured output.");
  }
  return {
    id: recipe.id,
    name: recipe.name,
    ...toolUse.input,
  };
}

const results = [];
let i = 0;
for (const recipe of recipes) {
  i++;
  try {
    const result = await backfillOne(recipe);
    results.push({
      ...result,
      _original_recipe: recipe.recipe ?? null,
      _original_ingredients: recipe.ingredients ?? [],
    });
    console.log(`Processed ${i}/${recipes.length}: ${recipe.name}`);
  } catch (err) {
    console.error(`Failed ${i}/${recipes.length}: ${recipe.name} — ${err.message}`);
    results.push({
      id: recipe.id,
      name: recipe.name,
      error: err.message,
      _original_recipe: recipe.recipe ?? null,
      _original_ingredients: recipe.ingredients ?? [],
    });
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} results to ${outputPath}. Review before running apply-recipe-backfill.mjs.`);
