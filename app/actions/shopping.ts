"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { categorizeItem } from "@/lib/categorize";
import { isFreshCategory } from "@/lib/categories";

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

// Edits an existing one-off item's quantity/unit/note — the tap-to-edit
// sheet shared with Kitchen's PantryItemSheet pattern.
export async function updateShoppingItem(
  id: string,
  quantityValue: number | null,
  quantityUnit: string | null,
  note: string | null
) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("shopping_items")
    .update({
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

  // If this row came from a flagged Fresh Kitchen item, checking it off
  // means "you bought it" — flip it back to in-stock automatically, same
  // loop the Restock/Pantry flow already uses. Pantry-category-sourced rows
  // (from the "+" deficit push) aren't touched here; on-hand for those is
  // corrected via Kitchen's own edit sheet, same as before this change.
  const { data: row } = await supabase
    .from("shopping_items")
    .select("source_pantry_item_id")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (row?.source_pantry_item_id) {
    const { data: sourceItem } = await supabase
      .from("pantry_items")
      .select("category")
      .eq("id", row.source_pantry_item_id)
      .maybeSingle();
    if (sourceItem && isFreshCategory(sourceItem.category as string)) {
      await supabase.from("pantry_items").update({ in_stock: true }).eq("id", row.source_pantry_item_id);
      revalidatePath("/kitchen");
    }
  }

  await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("household_id", household.householdId);

  revalidatePath("/shopping");
}
