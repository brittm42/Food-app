"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

function normalizeIngredientName(name: string) {
  return name.trim().toLowerCase();
}

// Upserts a household's on-hand quantity for an ingredient. Passing null
// for both value/unit clears it back to "unset" (not the same as deleting
// the row, but functionally identical for reconciliation — see
// lib/units.ts's reconcile(), which treats a missing on-hand value as
// "need more" either way).
export async function setPantryOnHand(
  ingredientName: string,
  quantityValue: number | null,
  quantityUnit: string | null
) {
  const trimmed = ingredientName.trim();
  if (!trimmed) return { error: "Missing ingredient name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("pantry_on_hand")
    .upsert(
      {
        household_id: household.householdId,
        ingredient_name: normalizeIngredientName(trimmed),
        quantity_value: quantityValue,
        quantity_unit: quantityUnit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,ingredient_name" }
    );

  if (error) return { error: error.message };

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
  return {};
}

// Same check/uncheck toggle as toggleChecked (app/actions/pantry.ts), but
// for "Check Core Pantry" Shopping List items specifically: checking one on
// also bumps its on-hand quantity by however much this week's recipes
// needed (the assumption being you just bought that much); unchecking
// symmetrically subtracts it back, so an accidental tap is harmless. Only
// touches on-hand when neededValue/neededUnit are non-null AND the
// ingredient's existing on-hand unit (if any) matches — anything else
// fails open: the box still toggles, on-hand is just left alone. Restock
// items don't go through this — they have no computed needed quantity to
// increment by, so they keep using plain toggleChecked.
export async function toggleCoreItemChecked(
  itemKey: string,
  ingredientName: string,
  neededValue: number | null,
  neededUnit: string | null
) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pantry_state")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("item_key", itemKey)
    .maybeSingle();

  const sign = existing ? -1 : 1;

  if (existing) {
    await supabase.from("pantry_state").delete().eq("id", existing.id);
  } else {
    await supabase.from("pantry_state").insert({
      household_id: household.householdId,
      user_id: household.userId,
      item_key: itemKey,
    });
  }

  if (neededValue != null && neededUnit != null) {
    const normalizedName = normalizeIngredientName(ingredientName);
    const { data: onHand } = await supabase
      .from("pantry_on_hand")
      .select("quantity_value, quantity_unit")
      .eq("household_id", household.householdId)
      .eq("ingredient_name", normalizedName)
      .maybeSingle();

    if (!onHand?.quantity_unit || onHand.quantity_unit === neededUnit) {
      const nextValue = Math.max(0, (onHand?.quantity_value ?? 0) + sign * neededValue);
      await supabase.from("pantry_on_hand").upsert(
        {
          household_id: household.householdId,
          ingredient_name: normalizedName,
          quantity_value: nextValue,
          quantity_unit: neededUnit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id,ingredient_name" }
      );

      // Mirror onto the matching Kitchen pantry_items row (if this
      // ingredient is also a catalog item) so the Kitchen tab's own on-hand
      // display doesn't drift from what Shopping List just recorded — see
      // the same note in updatePantryOnHand (app/actions/pantry.ts). Not
      // filtered by category: a core-tagged recipe ingredient is by
      // definition shelf-stable, so it should never actually match a Fresh
      // pantry_items row, but if it somehow did, writing an unused on-hand
      // value there is harmless (Fresh rows don't display it).
      await supabase
        .from("pantry_items")
        .update({ on_hand_qty: nextValue, on_hand_unit: neededUnit })
        .eq("household_id", household.householdId)
        .ilike("name", ingredientName.trim());
    }
  }

  revalidatePath("/kitchen");
  revalidatePath("/shopping");
}
