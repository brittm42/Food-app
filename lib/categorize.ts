// Auto-assigns a grocery-aisle category to a freeform item name (one-off
// Shopping List adds, new Staples) via a constrained Claude tool call — same
// pattern as generate-recipe.ts's draft_recipe tool. Kept as a plain
// function (not "use server") so it's a normal importable helper for any
// server action that needs it, rather than a directly client-callable action.
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category } from "@/lib/categories";

function buildTool(): Anthropic.Tool {
  return {
    name: "categorize_item",
    description: "Assign the single best-fit grocery-aisle category to a pantry/shopping list item.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: CATEGORIES as unknown as string[],
          description: "The single best-fit category for this item.",
        },
      },
      required: ["category"],
    },
  };
}

// Fails open to "Other" on any error (missing key, API failure, etc.) —
// mis-categorizing into a catch-all bucket is fine; silently dropping the
// add or blocking on a network hiccup is not.
export async function categorizeItem(name: string): Promise<Category> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !name.trim()) return "Other";

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 128,
      tools: [buildTool()],
      tool_choice: { type: "tool", name: "categorize_item" },
      messages: [{ role: "user", content: name.trim() }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return "Other";

    const category = (toolUse.input as { category?: string }).category;
    return (CATEGORIES as readonly string[]).includes(category ?? "") ? (category as Category) : "Other";
  } catch {
    return "Other";
  }
}
