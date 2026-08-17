"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { categorizeItem } from "@/lib/categorize";

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

  revalidatePath("/");
  revalidatePath("/shopping");
}

// New item added from Home Stock's "+" button. Category is auto-detected.
// Every item (Fresh, Pantry, or Household) uses the same binary in-stock
// model — the entered quantity becomes the "usual amount to buy" (target),
// used as the default when later flagged as needed.
export async function createPantryItem(
  name: string,
  qty: number | null = null,
  unit: string | null = null,
  note: string | null = null
) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const category = await categorizeItem(trimmed);
  const supabase = await createClient();

  const { error } = await supabase.from("pantry_items").insert({
    household_id: household.householdId,
    name: trimmed,
    category,
    item_type: "staple",
    target_qty: qty,
    target_unit: unit,
    note: note?.trim() || null,
    in_stock: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}

export async function deletePantryItem(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase.from("pantry_items").delete().eq("id", id).eq("household_id", household.householdId);

  revalidatePath("/");
  revalidatePath("/shopping");
}

// Edits the "usual amount to buy" — the default quantity used whenever this
// item is flagged as needed.
export async function updatePantryTarget(id: string, qtyValue: number | null, qtyUnit: string | null) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("pantry_items")
    .update({ target_qty: qtyValue, target_unit: qtyUnit })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  revalidatePath("/");
  return {};
}

// Edits the item's name/label (previously only fixable via delete + re-add).
export async function updatePantryItemName(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("pantry_items")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}

// Edits the freeform note (e.g. "Britt only," a brand/store preference).
export async function updatePantryNote(id: string, note: string | null) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("pantry_items")
    .update({ note: note?.trim() || null })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}

// The single "need it" flow for every Home Stock item (Fresh, Pantry, or
// Household alike): flips the binary state and drops it onto the Shopping
// List with a quantity specified right then — the sheet that calls this
// defaults to whichever is bigger, the item's usual amount or this week's
// computed recipe need, but it's always overridable.
export async function flagPantryItemNeeded(id: string, qtyValue: number | null, qtyUnit: string | null) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { error: updateError } = await supabase
    .from("pantry_items")
    .update({ in_stock: false })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (updateError) return { error: updateError.message };

  const { data: existingEntry } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("source_pantry_item_id", item.id)
    .maybeSingle();

  if (!existingEntry) {
    const { error } = await supabase.from("shopping_items").insert({
      household_id: household.householdId,
      label: item.note ? `${item.name} (${item.note})` : item.name,
      category: item.category,
      quantity_value: qtyValue,
      quantity_unit: qtyValue != null ? qtyUnit : null,
      note: item.note,
      source_pantry_item_id: item.id,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}

// Manually reverting an item back to "in stock" without going through the
// Shopping List (e.g. she remembered she still has eggs before actually
// buying more) — also cleans up the now-stale Shopping List entry so it
// doesn't linger unexplained.
export async function markPantryItemInStock(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("pantry_items")
    .update({ in_stock: true })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  await supabase
    .from("shopping_items")
    .delete()
    .eq("household_id", household.householdId)
    .eq("source_pantry_item_id", id);

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}
