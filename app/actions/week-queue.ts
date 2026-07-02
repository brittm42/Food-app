"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

function revalidateAffectedPaths() {
  revalidatePath("/");
  revalidatePath("/this-week");
  revalidatePath("/shopping");
}

export async function toggleThisWeek(recipeId: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("week_queue")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (existing) {
    await supabase.from("week_queue").delete().eq("id", existing.id);
  } else {
    await supabase.from("week_queue").insert({
      household_id: household.householdId,
      user_id: household.userId,
      recipe_id: recipeId,
    });
  }

  revalidateAffectedPaths();
}

export async function removeFromThisWeek(queueId: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase
    .from("week_queue")
    .delete()
    .eq("id", queueId)
    .eq("household_id", household.householdId);

  revalidateAffectedPaths();
}

export async function clearThisWeek() {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase
    .from("week_queue")
    .delete()
    .eq("household_id", household.householdId);

  revalidateAffectedPaths();
}
