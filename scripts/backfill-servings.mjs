import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "backfill-servings-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey || !supabaseUrl || !secretKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/backfill-servings.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-5";

const TOOL = {
  name: "estimate_servings",
  description: "Estimate how many servings a recipe makes, based on its ingredient quantities and steps.",
  input_schema: {
    type: "object",
    properties: {
      servings: {
        type: "integer",
        description: "Number of servings this recipe makes, as written (not doubled/halved).",
      },
    },
    required: ["servings"],
  },
};

const SYSTEM_PROMPT = `You are estimating how many servings an existing recipe in a household recipe library called WeeklyNom makes. Reason from the ingredient quantities and steps as written — e.g. "8 chicken thighs, 2 lemons" for a family-style dinner is usually 4 servings; a single-portion breakfast bowl is usually 1. Always call the estimate_servings tool with your answer.`;

function buildPrompt(recipe) {
  const ingredientList = (recipe.ingredients ?? [])
    .map((i) => `- ${i.quantity ? `${i.quantity}${i.unit ? " " + i.unit : ""} ` : ""}${i.name}`)
    .join("\n");
  return `Recipe name: ${recipe.name}
Hint: ${recipe.hint ?? ""}
Steps: ${(recipe.steps ?? []).join(" ") || recipe.recipe || "(none)"}

Ingredients:
${ingredientList || "(none)"}`;
}

async function estimateServings(recipe) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    thinking: { type: "disabled" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "estimate_servings" },
    messages: [{ role: "user", content: buildPrompt(recipe) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return structured output.");
  }
  return toolUse.input.servings;
}

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, hint, recipe, steps, ingredients, servings")
  .is("servings", null)
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
    const servings = await estimateServings(recipe);
    results.push({ id: recipe.id, name: recipe.name, servings });
    console.log(`[${i}/${recipes.length}] ${recipe.name} -> ${servings}`);
  } catch (err) {
    console.error(`Failed [${i}/${recipes.length}] ${recipe.name}: ${err.message}`);
    results.push({ id: recipe.id, name: recipe.name, error: err.message });
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} result(s) to ${outputPath}. Review before running apply-servings-backfill.mjs.`);
