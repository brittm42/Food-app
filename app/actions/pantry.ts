"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { categorizeItem } from "@/lib/categorize";
import { isFreshCategory } from "@/lib/categories";

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

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
}

// New item added from Kitchen's "+" button. Category is auto-detected, and
// determines behavior from here on (lib/categories.ts's isFreshCategory) —
// Fresh items get a binary in-stock state and no numeric tracking, so the
// entered quantity becomes the "usual amount to buy" (target); Pantry items
// keep the on-hand/target model, so it's stored as a starting on-hand value.
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
  const fresh = isFreshCategory(category);
  const supabase = await createClient();

  const { error } = await supabase.from("pantry_items").insert({
    household_id: household.householdId,
    name: trimmed,
    category,
    item_type: "staple",
    on_hand_qty: fresh ? null : qty,
    on_hand_unit: fresh ? null : unit,
    target_qty: fresh ? qty : null,
    target_unit: fresh ? unit : null,
    note: note?.trim() || null,
    in_stock: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

export async function deletePantryItem(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase.from("pantry_items").delete().eq("id", id).eq("household_id", household.householdId);

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
}

// Edits on-hand qty/unit for a Pantry-category item (Fresh items don't show
// this control at all — PantryItemSheet hides it). Mirrors the write into
// `pantry_on_hand` keyed by the item's (already clean) name so the existing
// recipe-driven reconciliation in Shopping List's "Check Core Pantry"
// section (app/shopping/page.tsx, lib/units.ts) keeps seeing the same
// value — pantry_items is the display/target source, pantry_on_hand stays
// the reconciliation source, this keeps them from drifting apart.
export async function updatePantryOnHand(id: string, qtyValue: number | null, qtyUnit: string | null) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pantry_items")
    .select("household_id, name, category")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { error } = await supabase
    .from("pantry_items")
    .update({ on_hand_qty: qtyValue, on_hand_unit: qtyUnit })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  if (!isFreshCategory(item.category as string)) {
    await supabase.from("pantry_on_hand").upsert(
      {
        household_id: household.householdId,
        ingredient_name: item.name.trim().toLowerCase(),
        quantity_value: qtyValue,
        quantity_unit: qtyUnit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,ingredient_name" }
    );
  }

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// Edits the target/par level (Pantry: "keep this much on hand") or the
// default add-to-list amount (Fresh: "the usual amount to buy").
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

  revalidatePath("/kitchen");
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

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// The "+" action from Kitchen's Pantry section: pushes this item onto the
// Shopping List, computing (target - on_hand) so restocking only asks for
// what's actually needed to get back to par. Fresh items don't use this —
// they go through flagPantryItemNeeded instead.
export async function addPantryItemToShoppingList(id: string) {
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

  const { data: existingEntry } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("source_pantry_item_id", item.id)
    .maybeSingle();
  if (existingEntry) return {}; // already on the list — a repeat tap is a no-op, not a duplicate

  const quantityUnit: string | null = item.target_unit ?? item.on_hand_unit ?? null;
  const quantityValue: number | null =
    item.target_qty != null
      ? item.on_hand_qty != null
        ? Math.max(item.target_qty - item.on_hand_qty, 0)
        : item.target_qty
      : null;

  const { error } = await supabase.from("shopping_items").insert({
    household_id: household.householdId,
    label: item.note ? `${item.name} (${item.note})` : item.name,
    category: item.category,
    quantity_value: quantityValue,
    quantity_unit: quantityValue != null ? quantityUnit : null,
    note: item.note,
    source_pantry_item_id: item.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// Undoes addPantryItemToShoppingList — tapping the "already on the list"
// checkmark removes the linked shopping_items row so a mistaken add is
// reversible, same as Fresh's markPantryItemInStock does for its own flow.
export async function removePantryItemFromShoppingList(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  await supabase
    .from("shopping_items")
    .delete()
    .eq("household_id", household.householdId)
    .eq("source_pantry_item_id", id);

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// Fresh items' "need it" flow: flips the binary state and drops it onto the
// Shopping List with a quantity specified right then (defaulting to the
// item's "usual amount" target, but overridable — see PantryItemSheet).
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

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// Manually reverting a Fresh item back to "in stock" without going through
// the Shopping List (e.g. she remembered she still has eggs before actually
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

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}
