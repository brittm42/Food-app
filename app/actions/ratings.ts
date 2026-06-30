"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RatingValue } from "@/lib/types";

export async function setRating(recipeId: string, rating: RatingValue) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("ratings")
    .select("rating")
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (existing?.rating === rating) {
    await supabase
      .from("ratings")
      .delete()
      .eq("user_id", user.id)
      .eq("recipe_id", recipeId);
  } else {
    await supabase.from("ratings").upsert(
      {
        user_id: user.id,
        recipe_id: recipeId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,recipe_id" }
    );
  }

  revalidatePath("/");
}
