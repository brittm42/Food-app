"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAffectedPaths() {
  revalidatePath("/");
  revalidatePath("/this-week");
  revalidatePath("/shopping");
}

export async function toggleThisWeek(recipeId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("week_queue")
    .select("id")
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (existing) {
    await supabase.from("week_queue").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("week_queue")
      .insert({ user_id: user.id, recipe_id: recipeId });
  }

  revalidateAffectedPaths();
}

export async function removeFromThisWeek(queueId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase
    .from("week_queue")
    .delete()
    .eq("id", queueId)
    .eq("user_id", userData.user.id);

  revalidateAffectedPaths();
}

export async function clearThisWeek() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from("week_queue").delete().eq("user_id", userData.user.id);

  revalidateAffectedPaths();
}
