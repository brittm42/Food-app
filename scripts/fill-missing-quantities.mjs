import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "fill-missing-quantities-output.json");

const apiKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey || !supabaseUrl || !secretKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/fill-missing-quantities.mjs"
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const supabase = createClient(supabaseUrl, secretKey);

const MODEL = "claude-sonnet-5";

const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 3,
};

const FILL_TOOL = {
  name: "fill_missing_quantities",
  description:
    "Provide a quantity/unit for each ingredient that currently has no quantity, grounded in the recipe's prose and — where the prose gives no basis — in comparable published recipes.",
  input_schema: {
    type: "object",
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Must exactly match one of the ingredient names listed as needing a quantity. Do not rename.",
            },
            quantity: {
              type: "string",
              description: 'Amount as it would appear in a recipe, e.g. "1", "2", "1/2", "2-3", "handful", "to taste".',
            },
            unit: {
              type: "string",
              description: 'Unit of measure, e.g. "cup", "tbsp", "clove", "can", "whole". Omit if quantity has no unit (e.g. "to taste").',
            },
          },
          required: ["name", "quantity"],
        },
      },
    },
    required: ["ingredients"],
  },
};

const RESEARCH_SYSTEM_PROMPT = `You are filling in missing ingredient quantities for an existing recipe in a household recipe library called WeeklyNom. Some ingredients in this recipe have no quantity because the original prose never stated an amount.

For each ingredient marked "NEEDS QUANTITY" below, decide on a realistic amount for the stated serving size (assume this recipe as written, not doubled/halved):
- If you're confident of a typical amount from general culinary knowledge (e.g. garlic is usually 1-3 cloves, a squeeze of lemon is about half a lemon), you can decide directly — no search needed.
- If you're not confident, or the recipe is a less common combination, use the web_search tool to find a comparable published recipe with similar ingredients and use it to ground a reasonable amount.

Respond with your reasoning and your final proposed quantity/unit for each ingredient that needs one. You'll be asked to finalize these into a structured format in a follow-up message — don't call any other tool now.`;

const FINALIZE_PROMPT =
  "Now call fill_missing_quantities with your final quantity/unit for each ingredient you were asked to fill in above.";

function buildResearchPrompt(recipe, missing) {
  const ingredientList = (recipe.ingredients ?? [])
    .map((i) => {
      const needs = missing.some((m) => m.name === i.name);
      const qty = i.quantity ? `${i.quantity}${i.unit ? " " + i.unit : ""}` : null;
      return `- ${i.name}${needs ? " — NEEDS QUANTITY" : qty ? ` — already has: ${qty}` : ""}`;
    })
    .join("\n");

  return `Recipe name: ${recipe.name}
Servings: ${recipe.servings ?? "(not specified)"}
Prose instructions: ${recipe.recipe ?? "(none — see steps below)"}
Steps: ${(recipe.steps ?? []).join(" ") || "(none)"}

Ingredients:
${ingredientList}`;
}

async function researchAndFill(recipe, missing) {
  const researchMessages = [{ role: "user", content: buildResearchPrompt(recipe, missing) }];

  let researchResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "disabled" },
    output_config: { effort: "medium" },
    system: RESEARCH_SYSTEM_PROMPT,
    tools: [WEB_SEARCH_TOOL],
    messages: researchMessages,
  });

  // Server-tool loop can pause after its internal iteration cap; resume by
  // resending the same history unchanged — the API detects the trailing
  // server_tool_use block and continues on its own (no "Continue" message).
  let resumes = 0;
  while (researchResponse.stop_reason === "pause_turn" && resumes < 3) {
    researchMessages.push({ role: "assistant", content: researchResponse.content });
    researchResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: { effort: "medium" },
      system: RESEARCH_SYSTEM_PROMPT,
      tools: [WEB_SEARCH_TOOL],
      messages: researchMessages,
    });
    resumes++;
  }

  const finalizeMessages = [
    ...researchMessages,
    { role: "assistant", content: researchResponse.content },
    { role: "user", content: FINALIZE_PROMPT },
  ];

  const finalizeResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    output_config: { effort: "medium" },
    tools: [FILL_TOOL],
    tool_choice: { type: "tool", name: "fill_missing_quantities" },
    messages: finalizeMessages,
  });

  const toolUse = finalizeResponse.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return structured output on the finalize step.");
  }
  return toolUse.input.ingredients ?? [];
}

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, name, recipe, steps, servings, ingredients")
  .order("name");

if (error) {
  console.error(error);
  process.exit(1);
}

const results = [];
let processed = 0;
let skipped = 0;

for (const recipe of recipes) {
  if (limit && processed >= limit) break;
  const missing = (recipe.ingredients ?? []).filter((i) => !i.quantity || i.quantity.trim() === "");
  if (missing.length === 0) {
    skipped++;
    continue;
  }

  processed++;
  console.log(`[${processed}] Researching ${missing.length} ingredient(s) for "${recipe.name}"...`);
  try {
    const filled = await researchAndFill(recipe, missing);
    results.push({ id: recipe.id, name: recipe.name, filled });
  } catch (err) {
    console.error(`Failed for "${recipe.name}": ${err.message}`);
    results.push({ id: recipe.id, name: recipe.name, error: err.message });
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(
  `\nWrote ${results.length} recipe(s) needing fills to ${outputPath} (${skipped} recipe(s) already had full quantities, skipped). Review before running apply-missing-quantities.mjs.`
);
