"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, Allergy } from "@/lib/types";
import type { RecipeInput } from "@/app/actions/recipes";
import { parseNumericQuantity } from "@/lib/units";
import { getCurrentHousehold } from "@/lib/household";
import { buildPreferencesNote, type HouseholdPreferencesContext } from "@/lib/preferences-note";
import { buildDraftRecipeTool } from "@/lib/recipe-draft-tool";
import { COMMON_INGREDIENT_NAMES } from "@/lib/common-ingredients";

const SYSTEM_PROMPT = `You are drafting a recipe for a household recipe library called WeeklyNom. The library's existing recipes share a consistent voice:
- Casual, brief hint lines (not full sentences of marketing copy).
- Protein- and fiber-forward home cooking, simple weeknight-friendly instructions.
- Instructions are an ordered list of discrete steps, not a single paragraph — one clear action per step. Light inline HTML (just <strong> for emphasis) inside a step is OK, no other markup.
- Ingredients are split into "Fresh" (perishable, weekly-buy) vs "Core" (shelf-stable pantry staples) for shopping list generation, and each also gets a grocery-aisle category (Produce, Dairy & Eggs, Meat & Seafood, Frozen, Bakery, Canned Goods, Grains & Dried, Sauces & Condiments, Spices, Beverages, Snacks, Household & Non-food, Other) used to group the Shopping List by aisle. Ingredient names must be bare nouns with no quantity or brand, and should reuse an existing name when the same ingredient is already in the library — the Shopping List dedupes ingredients by exact name match across recipes, so inconsistent naming creates duplicate entries. Quantities and units belong in their own fields, using realistic everyday-recipe conventions (fractions, ranges, or words like "handful"/"to taste" are fine — quantity is a string, not strictly numeric). Every ingredient must have a quantity, and every ingredient your steps mention — including pantry basics like oil, salt, pepper, and butter — must be listed, even if the amount is just "to taste" or "a drizzle". The ingredients list and the steps must never disagree about what's used.
- Estimate prep_time_minutes and cook_time_minutes only when there's a reasonable basis for it from the ingredient list/step count — omit rather than guess wildly.
Draft one recipe matching this voice based on the user's description. Always call the draft_recipe tool with your answer. If this is a follow-up turn revising an earlier draft, make only the changes the feedback asks for and keep everything else from the previous version as-is — always return the complete recipe (every field, not just what changed), and include change_summary.`;

export async function getHouseholdPreferencesContext(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<HouseholdPreferencesContext | null> {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const [{ data: profileRows }, { data: householdRow }] = await Promise.all([
    // No explicit household filter here — profiles_select's RLS policy
    // already restricts reads to every profile belonging to the caller's
    // household (their own row, every household mate's row, and every
    // dependent's row). That's exactly the aggregation we need: a severe
    // allergy belonging to any family member must always be respected,
    // regardless of who is chatting with the AI generator right now.
    supabase
      .from("profiles")
      .select("display_name, allergies, avoid_foods, cuisine_preferences, dietary_style, health_goals"),
    supabase
      .from("households")
      .select("weeknight_time_minutes, skill_level, meal_priorities")
      .eq("id", household.householdId)
      .maybeSingle(),
  ]);

  return {
    people: (profileRows ?? []).map((p) => ({
      displayName: p.display_name,
      allergies: (p.allergies as Allergy[] | null) ?? [],
      avoidFoods: p.avoid_foods ?? [],
      cuisinePreferences: p.cuisine_preferences ?? [],
      dietaryStyle: p.dietary_style ?? [],
      healthGoals: p.health_goals ?? [],
    })),
    weeknightTimeMinutes: householdRow?.weeknight_time_minutes ?? null,
    skillLevel: householdRow?.skill_level ?? null,
    mealPriorities: householdRow?.meal_priorities ?? [],
  };
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
  const [{ data: tagColors }, { data: cuisineColors }, { data: recipes }, householdContext] =
    await Promise.all([
      supabase.from("tag_colors").select("name"),
      supabase.from("cuisine_colors").select("name"),
      supabase.from("recipes").select("ingredients"),
      getHouseholdPreferencesContext(supabase),
    ]);

  const tagNames = (tagColors ?? []).map((t) => t.name as string);
  const knownCuisineNames = (cuisineColors ?? []).map((c) => c.name as string);
  // Curated common-ingredient baseline first, then whatever's actually in
  // the library — the library alone has accumulated some genuinely messy
  // entries (e.g. "Waffle mix", "Shredded cheese") that a naive reuse
  // instruction was matching against; the curated list gives the model a
  // correct anchor to prefer even for ingredients no recipe has used yet.
  const knownIngredientNames = [
    ...new Set([
      ...COMMON_INGREDIENT_NAMES,
      ...(recipes ?? []).flatMap(
        (r) => ((r as Pick<Recipe, "ingredients">).ingredients ?? []).map((i) => i.name)
      ),
    ]),
  ].sort();

  const client = new Anthropic({ apiKey });

  const preferencesNote = buildPreferencesNote(householdContext);

  try {
    const messages = nextMessages(history, description);
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT + preferencesNote,
      tools: [buildDraftRecipeTool(tagNames, knownIngredientNames, knownCuisineNames)],
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
