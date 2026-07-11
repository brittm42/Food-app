// Estimates how many of a matched Kroger product to buy for each Shopping
// List item — same constrained-tool-call pattern as lib/categorize.ts.
// Batched into one call (not one call per item) since the review screen
// needs this for every eligible item at once.
import Anthropic from "@anthropic-ai/sdk";

export type QuantityEstimateInput = {
  id: string;
  label: string;
  neededValue: number | null;
  neededUnit: string | null;
  note: string | null;
  matchedProductDescription: string | null;
};

function buildTool(): Anthropic.Tool {
  return {
    name: "estimate_kroger_quantities",
    description:
      "For each shopping list item, estimate how many units of the matched Kroger product to add to the cart.",
    input_schema: {
      type: "object",
      properties: {
        estimates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "The item's id, copied from the input." },
              quantity: {
                type: "integer",
                minimum: 1,
                description: "How many of the matched product to buy.",
              },
            },
            required: ["id", "quantity"],
          },
        },
      },
      required: ["estimates"],
    },
  };
}

function buildPrompt(items: QuantityEstimateInput[]): string {
  const lines = items.map((item) => {
    const needed =
      item.neededValue != null && item.neededUnit
        ? `needs ${item.neededValue} ${item.neededUnit} for this week's recipes`
        : "no specific recipe quantity (a loose/one-off item)";
    const note = item.note ? ` Household note: "${item.note}".` : "";
    const matched = item.matchedProductDescription
      ? ` Matched Kroger product: "${item.matchedProductDescription}".`
      : "";
    return `- id=${item.id}: "${item.label}" — ${needed}.${note}${matched}`;
  });

  return [
    "Estimate how many of each matched Kroger product to buy, based on how much is needed for the recipe(s) this week versus the matched product's typical package size (infer package size from the product description, e.g. \"15 oz\" or \"Bag\").",
    "Default to 1 whenever the needed amount is vague, loose, or you're not confident (e.g. a one-off item with no recipe quantity, or a measured amount like \"2 tbsp\" that doesn't clearly map to a package count).",
    "",
    ...lines,
  ].join("\n");
}

// Fails open to quantity 1 for every item on any error — a safe, always-
// reviewable default beats blocking the whole review screen on an AI call.
export async function estimateQuantities(
  items: QuantityEstimateInput[]
): Promise<Record<string, number>> {
  const fallback = Object.fromEntries(items.map((item) => [item.id, 1]));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || items.length === 0) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [buildTool()],
      tool_choice: { type: "tool", name: "estimate_kroger_quantities" },
      messages: [{ role: "user", content: buildPrompt(items) }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return fallback;

    const estimates = (toolUse.input as { estimates?: { id: string; quantity: number }[] })
      .estimates;
    if (!Array.isArray(estimates)) return fallback;

    const result = { ...fallback };
    for (const estimate of estimates) {
      if (typeof estimate.id === "string" && Number.isInteger(estimate.quantity) && estimate.quantity > 0) {
        result[estimate.id] = estimate.quantity;
      }
    }
    return result;
  } catch {
    return fallback;
  }
}
