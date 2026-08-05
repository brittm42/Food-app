import Anthropic from "@anthropic-ai/sdk";
import { SUB_CATEGORIES, DIETARY_STYLES } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

// Shared by generate-recipe.ts (drafting from a mood/description) and
// import-recipe.ts (extracting from a URL/pasted text) — same recipe shape
// either way, just a different system prompt around faithfulness vs.
// invention. Kept out of the "use server" actions files since Next.js
// requires every export of a "use server" module to be an async action,
// and this is a plain synchronous builder.
const CATEGORY_IDS = Object.values(SUB_CATEGORIES).flatMap((subs) => subs.map((s) => s.id));
const DIETARY_STYLE_IDS = Object.keys(DIETARY_STYLES);

export function buildDraftRecipeTool(
  tagNames: string[],
  knownIngredientNames: string[],
  knownCuisineNames: string[]
): Anthropic.Tool {
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
          items: { type: "string" },
          description:
            "Zero or more cuisines that fit this recipe, as plain display names (e.g. \"Mexican\", not an id). " +
            (knownCuisineNames.length
              ? `Reuse one of these existing names whenever it's a genuine match, so cuisines stay consistent across the library: ${knownCuisineNames.join(", ")}. `
              : "") +
            "Only introduce a new cuisine name if the dish genuinely doesn't fit any existing one — don't force a near-match.",
        },
        dietary_style: {
          type: "array",
          items: { type: "string", enum: DIETARY_STYLE_IDS },
          description:
            "Zero or more dietary styles this recipe genuinely satisfies as written (e.g. only include \"vegan\" if there is truly no meat, fish, dairy, eggs, or other animal product anywhere in the ingredients). Leave empty if none apply — do not guess.",
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
            "Estimated active prep time in minutes (hands-on chopping/mixing/etc., not time the dish spends unattended cooking), only if you have a reasonable basis for estimating it from the ingredient list/step count. Omit if you'd just be guessing.",
        },
        cook_time_minutes: {
          type: "integer",
          description:
            "Estimated unattended cook time in minutes (oven/stovetop/baking time), separate from prep time. Omit if there's no real cooking step (e.g. a no-cook recipe) or you'd just be guessing.",
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
