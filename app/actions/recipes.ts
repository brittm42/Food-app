"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";
import { categorizeItem } from "@/lib/categorize";
import { getCurrentHousehold } from "@/lib/household";

export type RecipeInput = Omit<
  Recipe,
  | "id"
  | "created_by"
  | "household_id"
  | "is_public"
  | "imported_from_recipe_id"
  | "is_seed"
  | "created_at"
  | "updated_at"
>;

// AI generation already assigns a category per ingredient; manual entry via
// RecipeForm has no category input, so fill it in here the same way one-off
// Shopping List/Staple adds get auto-categorized.
async function withIngredientCategories(input: RecipeInput): Promise<RecipeInput> {
  const ingredients = await Promise.all(
    (input.ingredients ?? []).map(async (ing) =>
      ing.category ? ing : { ...ing, category: await categorizeItem(ing.name) }
    )
  );
  return { ...input, ingredients };
}

export async function createRecipe(input: RecipeInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "You need a household before adding recipes." };

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      ...(await withIngredientCategories(input)),
      household_id: household.householdId,
      created_by: user.id,
      is_seed: false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { id: data.id as string };
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  // Recipes are household-owned — the recipes_update RLS policy only
  // permits updating rows in household_id in current_household_ids(), so
  // this can never touch another household's copy.
  const { error } = await supabase.from("recipes").update(await withIngredientCategories(input)).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

export async function deleteRecipe(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  // recipes_delete RLS confines this to the caller's own household's rows;
  // ratings and week_queue both cascade on recipe_id, so no orphan cleanup
  // is needed here.
  const { error } = await supabase.from("recipes").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

export async function importRecipe(sourceId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "You need a household before importing recipes." };

  const source = await getRecipeById(sourceId);
  if (!source) return { error: "That recipe doesn't exist." };
  if (source.household_id === household.householdId) {
    return { error: "Already in your kitchen." };
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      name: source.name,
      category: source.category,
      cuisines: source.cuisines,
      emoji: source.emoji,
      hint: source.hint,
      recipe: source.recipe,
      steps: source.steps,
      prep_time_minutes: source.prep_time_minutes,
      source: source.source,
      servings: source.servings,
      protein: source.protein,
      fiber: source.fiber,
      cal: source.cal,
      tags: source.tags,
      ingredients: source.ingredients,
      household_id: household.householdId,
      created_by: user.id,
      is_seed: false,
      is_ai_generated: source.is_ai_generated,
      imported_from_recipe_id: source.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/discover");
  return { id: data.id as string };
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  return data as Recipe | null;
}

export async function createTagColor(name: string, color: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("tag_colors")
    .upsert({ name, color }, { onConflict: "name", ignoreDuplicates: true });

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}
