"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { categorizeItem } from "@/lib/categorize";

export async function addShoppingItem(
  label: string,
  quantityValue: number | null = null,
  quantityUnit: string | null = null,
  note: string | null = null
) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const category = await categorizeItem(trimmed);
  const supabase = await createClient();

  const { error } = await supabase.from("shopping_items").insert({
    household_id: household.householdId,
    label: trimmed,
    category,
    quantity_value: quantityValue,
    quantity_unit: quantityUnit,
    note: note?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/shopping");
  return {};
}

// Edits an existing one-off item's label/quantity/unit/note — the tap-to-edit
// sheet shared with Kitchen's PantryItemSheet pattern.
export async function updateShoppingItem(
  id: string,
  label: string,
  quantityValue: number | null,
  quantityUnit: string | null,
  note: string | null
) {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("shopping_items")
    .update({
      label: trimmedLabel,
      quantity_value: quantityValue,
      quantity_unit: quantityValue != null ? quantityUnit : null,
      note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidatePath("/shopping");
  return {};
}

export async function removeShoppingItem(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  // If this row came from a flagged/restocked Home Stock item, checking it
  // off means "you bought it" — flip it back to in-stock automatically,
  // same loop the Kitchen restock flow already uses. Every item (Fresh,
  // Pantry, or Household) is binary now, so this applies uniformly.
  const { data: row } = await supabase
    .from("shopping_items")
    .select("source_pantry_item_id")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (row?.source_pantry_item_id) {
    await supabase.from("pantry_items").update({ in_stock: true }).eq("id", row.source_pantry_item_id);
    revalidatePath("/");
  }

  await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("household_id", household.householdId);

  revalidatePath("/shopping");
}
