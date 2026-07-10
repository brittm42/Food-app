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

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}

// New Staple (item_type defaults to 'staple' — Core Pantry/Weekly Fresh
// items are seeded once by scripts/seed-pantry-items.mjs, not created
// through this everyday add flow).
export async function createPantryItem(
  name: string,
  onHandQty: number | null = null,
  onHandUnit: string | null = null,
  targetQty: number | null = null,
  targetUnit: string | null = null
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
    on_hand_qty: onHandQty,
    on_hand_unit: onHandUnit,
    target_qty: targetQty,
    target_unit: targetUnit,
  });

  if (error) return { error: error.message };

  revalidatePath("/pantry");
  revalidatePath("/shopping");
  return {};
}

export async function deletePantryItem(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  await supabase.from("pantry_items").delete().eq("id", id).eq("household_id", household.householdId);

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}

// Edits on-hand qty/unit for a pantry item. For item_type === 'core', also
// mirrors the write into `pantry_on_hand` keyed by the item's (already
// clean) name, so the existing recipe-driven reconciliation in Shopping
// List's "Check Core Pantry" section (app/shopping/page.tsx, lib/units.ts)
// keeps seeing the same value — pantry_items is the new display/target
// source, pantry_on_hand stays the reconciliation source, this keeps them
// from drifting apart for the one item_type that touches both.
export async function updatePantryOnHand(id: string, qtyValue: number | null, qtyUnit: string | null) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pantry_items")
    .select("household_id, name, item_type")
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

  if (item.item_type === "core") {
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

  revalidatePath("/pantry");
  revalidatePath("/shopping");
  return {};
}

// Edits the target/par level (core/staple: "keep this much on hand") or the
// default add-to-list amount (weekly_fresh: "the usual amount to buy").
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

  revalidatePath("/pantry");
  return {};
}

// The "+" action from Pantry: pushes this item onto the Shopping List.
// weekly_fresh has no on-hand concept, so it just adds its stored default
// amount; core/staple compute (target - on_hand) so restocking only asks
// for what's actually needed to get back to par.
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

  let quantityValue: number | null = null;
  const quantityUnit: string | null = item.target_unit ?? item.on_hand_unit ?? null;

  if (item.item_type === "weekly_fresh") {
    quantityValue = item.target_qty;
  } else if (item.target_qty != null) {
    quantityValue =
      item.on_hand_qty != null ? Math.max(item.target_qty - item.on_hand_qty, 0) : item.target_qty;
  }

  const { error } = await supabase.from("shopping_items").insert({
    household_id: household.householdId,
    label: item.note ? `${item.name} (${item.note})` : item.name,
    category: item.category,
    quantity_value: quantityValue,
    quantity_unit: quantityValue != null ? quantityUnit : null,
    source_pantry_item_id: item.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/pantry");
  revalidatePath("/shopping");
  return {};
}
