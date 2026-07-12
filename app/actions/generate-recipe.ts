"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SUB_CATEGORIES, CUISINE_LABELS } from "@/lib/types";
import type { Recipe } from "@/lib/types";
import type { RecipeInput } from "@/app/actions/recipes";
import { parseNumericQuantity } from "@/lib/units";
import { CATEGORIES } from "@/lib/categories";

const CATEGORY_IDS = Object.values(SUB_CATEGORIES).flatMap((subs) => subs.map((s) => s.id));
const CUISINE_IDS = Object.keys(CUISINE_LABELS);

function buildTool(tagNames: string[], knownIngredientNames: string[]): Anthropic.Tool {
  return {
    name: "draft_recipe",
    description: "Draft a structured recipe for the WeeklyNom recipe library.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, appetizing recipe name." },
        category: {
          type: "string",
          enum: CATEGORY_IDS,
          description: "The single best-fit sub-category id for this recipe.",
        },
        cuisines: {
          type: "array",
          items: { type: "string", enum: CUISINE_IDS },
          description: "Zero or more cuisine tags that fit this recipe.",
        },
        emoji: { type: "string", description: "A single emoji representing the dish." },
        hint: {
          type: "string",
          description: "A short, casual one-line description (PRD voice: friendly, brief).",
        },
        steps: {
          type: "array",
          items: { type: "string" },
          description:
            "Ordered list of instruction steps, one clear action per step (not a single paragraph). Light inline HTML like <strong> is OK for emphasis; no other markup. Every ingredient named in a step — including pantry basics like oil, salt, pepper, and butter — must also appear as its own entry in the ingredients list. Never mention an ingredient in a step that isn't listed.",
        },
        prep_time_minutes: {
          type: "integer",
          description:
            "Estimated active prep time in minutes, only if you have a reasonable basis for estimating it from the ingredient list/step count. Omit if you'd just be guessing.",
        },
        source: {
          type: "string",
          description:
            "URL or citation for where this recipe came from, only if the user's description mentions or links one. Omit entirely if no source was given — never invent one.",
        },
        servings: { type: "integer", description: "Number of servings this recipe makes." },
        protein: {
          type: "number",
          description:
            "Grams of protein per serving, only if you have a reasonable basis for estimating it from the ingredients. Omit if you'd just be guessing.",
        },
        fiber: {
          type: "number",
          description:
            "Grams of fiber per serving, only if you have a reasonable basis for estimating it from the ingredients. Omit if you'd just be guessing.",
        },
        cal: {
          type: "number",
          description:
            "Calories per serving, only if you have a reasonable basis for estimating it from the ingredients. Omit if you'd just be guessing.",
        },
        change_summary: {
          type: "string",
          description:
            "One short, casual sentence summarizing what changed from the previous draft (e.g. \"Swapped the chicken for tofu and dropped the dairy.\"). Only include this when revising an earlier draft based on feedback — omit entirely when drafting the very first version.",
        },
        tags: {
          type: "array",
          items: { type: "string", enum: tagNames },
          description:
            "Zero or more existing tags that fit this recipe. Only pick from the provided list — never invent a new tag name, even if none fit perfectly. Leave empty if nothing fits.",
        },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  `Bare ingredient name only — no quantity, brand, or prep notes (write "Black beans", never "1 can black beans" or "Black beans (15oz)"). ` +
                  (knownIngredientNames.length
                    ? `Reuse one of these existing names whenever it's the same ingredient, so it matches across recipes on the Shopping List: ${knownIngredientNames.join(", ")}.`
                    : ""),
              },
              core: {
                type: "boolean",
                description:
                  "true if this is a shelf-stable Core Pantry item, false if it's a Fresh/weekly-buy item.",
              },
              category: {
                type: "string",
                enum: CATEGORIES as unknown as string[],
                description: "The single best-fit grocery-aisle category for this ingredient.",
              },
              quantity: {
                type: "string",
                description:
                  'Amount as it would appear in a recipe. Free text, not strictly numeric — always give a real value: a number ("1", "1/2", "2-3"), a count word ("a few", "handful"), or "to taste" for seasonings. Never omit this.',
              },
              unit: {
                type: "string",
                description:
                  'Unit of measure, e.g. "cup", "tbsp", "clove", "can", "whole". Omit only if quantity has no unit (e.g. "to taste", "3 eggs" with quantity "3" and no unit).',
              },
            },
            required: ["name", "core", "category", "quantity"],
          },
        },
      },
      required: ["name", "category", "cuisines", "emoji", "hint", "steps", "servings", "tags", "ingredients"],
    },
  };
}

const SYSTEM_PROMPT = `You are drafting a recipe for a household recipe library called WeeklyNom. The library's existing recipes share a consistent voice:
- Casual, brief hint lines (not full sentences of marketing copy).
- Protein- and fiber-forward home cooking, simple weeknight-friendly instructions.
- Instructions are an ordered list of discrete steps, not a single paragraph — one clear action per step. Light inline HTML (just <strong> for emphasis) inside a step is OK, no other markup.
- Ingredients are split into "Fresh" (perishable, weekly-buy) vs "Core" (shelf-stable pantry staples) for shopping list generation, and each also gets a grocery-aisle category (Produce, Dairy & Eggs, Meat & Seafood, Frozen, Bakery, Canned Goods, Grains & Dried, Sauces & Condiments, Spices, Beverages, Snacks, Household & Non-food, Other) used to group the Shopping List by aisle. Ingredient names must be bare nouns with no quantity or brand, and should reuse an existing name when the same ingredient is already in the library — the Shopping List dedupes ingredients by exact name match across recipes, so inconsistent naming creates duplicate entries. Quantities and units belong in their own fields, using realistic everyday-recipe conventions (fractions, ranges, or words like "handful"/"to taste" are fine — quantity is a string, not strictly numeric). Every ingredient must have a quantity, and every ingredient your steps mention — including pantry basics like oil, salt, pepper, and butter — must be listed, even if the amount is just "to taste" or "a drizzle". The ingredients list and the steps must never disagree about what's used.
- Estimate prep_time_minutes only when there's a reasonable basis for it from the ingredient list/step count — omit rather than guess wildly.
Draft one recipe matching this voice based on the user's description. Always call the draft_recipe tool with your answer. If this is a follow-up turn revising an earlier draft, make only the changes the feedback asks for and keep everything else from the previous version as-is — always return the complete recipe (every field, not just what changed), and include change_summary.`;

function buildPreferencesNote(prefs: {
  allergies: string[];
  avoidFoods: string[];
  cuisinePreferences: string[];
} | null): string {
  if (!prefs) return "";
  const lines: string[] = [];
  if (prefs.allergies.length) {
    lines.push(
      `The person this recipe is for has these allergies/dietary restrictions — never include these ingredients: ${prefs.allergies.join(", ")}.`
    );
  }
  if (prefs.avoidFoods.length) {
    lines.push(
      `They'd also rather avoid (not an allergy, just a preference): ${prefs.avoidFoods.join(", ")}.`
    );
  }
  if (prefs.cuisinePreferences.length) {
    lines.push(`They especially enjoy these cuisines: ${prefs.cuisinePreferences.join(", ")}.`);
  }
  return lines.length ? `\n\n${lines.join(" ")}` : "";
}

export type ChatTurn = Anthropic.MessageParam;

function nextMessages(history: ChatTurn[], description: string): ChatTurn[] {
  if (history.length === 0) return [{ role: "user", content: description }];
  const lastAssistant = history[history.length - 1];
  const toolUse =
    Array.isArray(lastAssistant.content) &&
    lastAssistant.content.find((b) => b.type === "tool_use");
  const content: Anthropic.MessageParam["content"] = toolUse
    ? [
        { type: "tool_result", tool_use_id: toolUse.id, content: "Got it." },
        { type: "text", text: description },
      ]
    : description;
  return [...history, { role: "user", content }];
}

export async function generateRecipeDraft(
  description: string,
  history: ChatTurn[] = []
): Promise<{ recipe?: RecipeInput; error?: string; history?: ChatTurn[]; changeSummary?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI generation isn't configured (missing ANTHROPIC_API_KEY)." };
  if (!description.trim()) return { error: "Describe the recipe idea first." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const [{ data: tagColors }, { data: recipes }, { data: profile }] = await Promise.all([
    supabase.from("tag_colors").select("name"),
    supabase.from("recipes").select("ingredients"),
    userData.user
      ? supabase
          .from("profiles")
          .select("allergies, avoid_foods, cuisine_preferences")
          .eq("user_id", userData.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const tagNames = (tagColors ?? []).map((t) => t.name as string);
  const knownIngredientNames = [
    ...new Set(
      (recipes ?? []).flatMap(
        (r) => ((r as Pick<Recipe, "ingredients">).ingredients ?? []).map((i) => i.name)
      )
    ),
  ].sort();

  const client = new Anthropic({ apiKey });

  const preferencesNote = buildPreferencesNote(
    profile
      ? {
          allergies: profile.allergies ?? [],
          avoidFoods: profile.avoid_foods ?? [],
          cuisinePreferences: profile.cuisine_preferences ?? [],
        }
      : null
  );

  try {
    const messages = nextMessages(history, description);
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT + preferencesNote,
      tools: [buildTool(tagNames, knownIngredientNames)],
      tool_choice: { type: "tool", name: "draft_recipe" },
      messages,
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { error: "AI didn't return a structured recipe. Try again." };
    }

    const { change_summary, ...recipe } = toolUse.input as RecipeInput & { change_summary?: string };
    // Deterministically derive canonical quantity_value/quantity_unit from
    // the free-text quantity/unit the AI already wrote, rather than asking
    // the AI to fill a second, redundant representation — one parser
    // (lib/units.ts) stays the single source of truth, same as the manual
    // RecipeForm save path and the backfill script use.
    recipe.ingredients = (recipe.ingredients ?? []).map((ing) => {
      const parsed = parseNumericQuantity(ing.quantity, ing.unit);
      return { ...ing, quantity_value: parsed?.value ?? null, quantity_unit: parsed?.unit ?? null };
    });

    return {
      recipe,
      changeSummary: change_summary,
      history: [...messages, { role: "assistant", content: message.content }],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed." };
  }
}
