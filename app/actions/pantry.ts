"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

export async function toggleChecked(itemKey: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pantry_state")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("item_key", itemKey)
    .maybeSingle();

  if (existing) {
    await supabase.from("pantry_state").delete().eq("id", existing.id);
  } else {
    await supabase.from("pantry_state").insert({
      household_id: household.householdId,
      user_id: household.userId,
      item_key: itemKey,
    });
  }

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}

export async function addStaple(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase.from("pantry_staples").insert({
    household_id: household.householdId,
    user_id: household.userId,
    label: trimmed,
  });

  if (error) return { error: error.message };

  revalidatePath("/pantry");
  revalidatePath("/shopping");
  return {};
}

export async function deleteStaple(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase
    .from("pantry_staples")
    .delete()
    .eq("id", id)
    .eq("household_id", household.householdId);

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}
