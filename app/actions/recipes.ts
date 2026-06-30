"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";

export type RecipeInput = Omit<
  Recipe,
  "id" | "user_id" | "is_seed" | "created_at" | "updated_at"
>;

export async function createRecipe(input: RecipeInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...input, user_id: user.id, is_seed: false })
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

  // Any signed-in user can edit any recipe, including seed library recipes
  // (not just their own additions) — enforced by the recipes_update RLS
  // policy, which permits user_id is null or user_id = auth.uid().
  const { error } = await supabase.from("recipes").update(input).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
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
