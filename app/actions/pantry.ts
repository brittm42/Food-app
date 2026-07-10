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

export async function addStaple(label: string, quantity: string | null = null) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase.from("pantry_staples").insert({
    household_id: household.householdId,
    user_id: household.userId,
    label: trimmed,
    quantity: quantity?.trim() || null,
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

// Permanently hides a static Core Pantry / Weekly Fresh catalog entry for
// this household (e.g. "we'll never keep Farro on hand"). The underlying
// CORE_PANTRY/WEEKLY_FRESH config is untouched — this just records an
// override so it stops rendering, and can be undone with restoreCatalogItem.
export async function removeCatalogItem(catalogKey: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase.from("pantry_catalog_removed").insert({
    household_id: household.householdId,
    item_key: catalogKey,
  });

  revalidatePath("/pantry");
}

export async function restoreCatalogItem(catalogKey: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase
    .from("pantry_catalog_removed")
    .delete()
    .eq("household_id", household.householdId)
    .eq("item_key", catalogKey);

  revalidatePath("/pantry");
}
