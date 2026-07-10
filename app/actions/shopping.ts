"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

export async function addShoppingItem(label: string, isFood: boolean, quantity: string | null = null) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase.from("shopping_items").insert({
    household_id: household.householdId,
    label: trimmed,
    is_food: isFood,
    quantity: quantity?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/shopping");
  return {};
}

export async function removeShoppingItem(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("household_id", household.householdId);

  revalidatePath("/shopping");
}
