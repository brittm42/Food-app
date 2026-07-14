"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getHouseholdPreferencesContext } from "@/app/actions/generate-recipe";
import { buildPreferencesNote } from "@/lib/preferences-note";
import { importRecipe } from "@/app/actions/recipes";
import { toggleThisWeek } from "@/app/actions/week-queue";
import { getHouseholdCookingProfile } from "@/app/actions/household";
import { flagAllergensInRecipe } from "@/lib/allergens";
import { prepopulateCoreIngredients } from "@/lib/kitchen-prepopulate";
import { mealTypeForCategory, MEAL_TYPES } from "@/lib/types";
import type { Recipe, MealType, Allergy } from "@/lib/types";

export type CuratedPick = {
  recipeId: string;
  name: string;
  emoji: string | null;
  hint: string | null;
  cuisines: string[];
  mealType: MealType;
  reason: string;
};

const PICKS_PER_MEAL_TYPE = 4;

// Every household member's allergies, aggregated the same way
// buildPreferencesNote does — a strict_avoidance allergy belonging to any
// family member (not just the person running onboarding) must exclude a
// candidate recipe outright.
function collectStrictAllergies(
  people: { allergies: Allergy[] }[]
): Allergy[] {
  return people.flatMap((p) => p.allergies.filter((a) => a.handling === "strict_avoidance"));
}

export async function curateStarterRecipes(): Promise<{ picks?: CuratedPick[]; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI curation isn't configured (missing ANTHROPIC_API_KEY)." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();
  const [{ data: candidates, error }, cookingProfile, prefsContext] = await Promise.all([
    supabase.from("recipes").select("*").eq("is_public", true).neq("household_id", household.householdId),
    getHouseholdCookingProfile(),
    getHouseholdPreferencesContext(supabase),
  ]);
  if (error) return { error: error.message };

  const mealTypes: MealType[] = cookingProfile?.mealPriorities?.length
    ? cookingProfile.mealPriorities
    : (MEAL_TYPES.map((m) => m.id).filter((id) => id !== "solo") as MealType[]);

  const strictAllergies = collectStrictAllergies(prefsContext?.people ?? []);
  const eligible = ((candidates ?? []) as Recipe[]).filter((r) => {
    const flags = flagAllergensInRecipe(r.ingredients, strictAllergies);
    return flags.length === 0;
  });

  const pool = eligible
    .map((r) => ({
      id: r.id,
      name: r.name,
      hint: r.hint,
      mealType: mealTypeForCategory(r.category),
      cuisines: r.cuisines,
      dietary_style: r.dietary_style,
      tags: r.tags,
      protein: r.protein,
      fiber: r.fiber,
      cal: r.cal,
    }))
    .filter((r) => mealTypes.includes(r.mealType));

  if (pool.length === 0) return { picks: [] };

  const byId = new Map(eligible.map((r) => [r.id, r]));

  const client = new Anthropic({ apiKey });
  const TOOL: Anthropic.Tool = {
    name: "pick_starter_recipes",
    description: "Pick starter recipes for a brand-new household from a candidate pool, grouped by meal type.",
    input_schema: {
      type: "object",
      properties: {
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_type: { type: "string", enum: mealTypes },
              picks: {
                type: "array",
                maxItems: PICKS_PER_MEAL_TYPE,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "The candidate recipe's id, copied exactly from the pool." },
                    reason: {
                      type: "string",
                      description: "One short, casual sentence on why this fits this specific household.",
                    },
                  },
                  required: ["id", "reason"],
                },
              },
            },
            required: ["meal_type", "picks"],
          },
        },
      },
      required: ["groups"],
    },
  };

  const preferencesNote = buildPreferencesNote(prefsContext);
  const systemPrompt = `You are picking starter recipes for a brand-new household on WeeklyNom, a household meal-planning app. Pick up to ${PICKS_PER_MEAL_TYPE} recipes per requested meal type from the candidate pool provided — favor genuine variety (different cuisines and cooking styles), not near-duplicates. Only pick ids that appear in the pool. Always call the pick_starter_recipes tool with your answer.${preferencesNote}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "pick_starter_recipes" },
      messages: [
        {
          role: "user",
          content: `Meal types to curate for: ${mealTypes.join(", ")}.\n\nCandidate pool:\n${JSON.stringify(pool)}`,
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { error: "AI didn't return curated picks. Try again." };
    }

    const groups = (toolUse.input as { groups: { meal_type: string; picks: { id: string; reason: string }[] }[] }).groups;
    const picks: CuratedPick[] = [];
    for (const group of groups) {
      for (const p of group.picks) {
        const recipe = byId.get(p.id);
        if (!recipe) continue; // AI hallucinated an id outside the pool — skip rather than fail
        picks.push({
          recipeId: recipe.id,
          name: recipe.name,
          emoji: recipe.emoji,
          hint: recipe.hint,
          cuisines: recipe.cuisines,
          mealType: mealTypeForCategory(recipe.category),
          reason: p.reason,
        });
      }
    }

    return { picks };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI curation failed." };
  }
}

// Best-effort: one failed import/queue shouldn't block the rest of the
// wizard, since the required-recipe step (not curation) is the hard gate.
export async function applyStarterRecipeSelections(recipeIds: string[]): Promise<{ error?: string }> {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  for (const id of recipeIds) {
    const result = await importRecipe(id);
    if (result.id) {
      await toggleThisWeek(result.id);
    }
  }

  revalidatePath("/");
  revalidatePath("/this-week");
  return {};
}

export async function finishOnboarding(): Promise<{ error?: string }> {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();
  await prepopulateCoreIngredients(supabase, household.householdId, { assumeStocked: true });

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: household.userId, onboarding_status: "completed" }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  revalidatePath("/this-week");
  revalidatePath("/onboarding");
  return {};
}
