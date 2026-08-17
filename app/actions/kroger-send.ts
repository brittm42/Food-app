"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { addToCart } from "@/lib/kroger/cart";

export type SendItem = {
  label: string;
  category: string;
  neededValue: number | null;
  neededUnit: string | null;
  sourceChecklistKey: string | null;
  sourceShoppingItemId: string | null;
  upc: string;
  productDescription: string;
  quantity: number;
};

// Sends the confirmed review-screen selection to the household's real
// Kroger cart, then records "sent" state locally. The cart write happens
// first — Kroger's Cart API has no undo, so a DB failure after a
// successful cart write just means the item shows as still-unsent (an
// annoying but recoverable state); the reverse (marked sent, never
// actually in the cart) would be worse and silent.
export async function sendToKroger(items: SendItem[]) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (items.length === 0) return { error: "Nothing selected to send." };

  try {
    await addToCart(
      household.householdId,
      items.map((item) => ({ upc: item.upc, quantity: item.quantity }))
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kroger cart request failed." };
  }

  const supabase = await createClient();
  const sentAt = new Date().toISOString();

  for (const item of items) {
    if (item.sourceChecklistKey) {
      const { error } = await supabase.from("shopping_items").insert({
        household_id: household.householdId,
        label: item.label,
        category: item.category,
        quantity_value: item.neededValue,
        quantity_unit: item.neededUnit,
        source_checklist_key: item.sourceChecklistKey,
        sent_at: sentAt,
        kroger_upc: item.upc,
        kroger_product_description: item.productDescription,
        kroger_quantity: item.quantity,
      });
      if (error) return { error: `Sent to Kroger, but failed to save locally: ${error.message}` };
    } else if (item.sourceShoppingItemId) {
      const { error } = await supabase
        .from("shopping_items")
        .update({
          sent_at: sentAt,
          kroger_upc: item.upc,
          kroger_product_description: item.productDescription,
          kroger_quantity: item.quantity,
        })
        .eq("id", item.sourceShoppingItemId)
        .eq("household_id", household.householdId);
      if (error) return { error: `Sent to Kroger, but failed to save locally: ${error.message}` };
    }
  }

  revalidatePath("/shopping");
  return {};
}

function normalizeIngredientName(name: string) {
  return name.trim().toLowerCase();
}

// Pins a specific Kroger product as the household's default pick for an
// ingredient — the review screen (lib/kroger/review.ts's buildReviewItems)
// pre-selects this instead of Kroger's own top-search-relevance result from
// then on. Still just the default: the swap dropdown stays fully populated,
// so any individual order can still pick something else. Household-scoped,
// not per-person — matches the Kroger connection itself being shared.
export async function setFavoriteProduct(
  ingredientName: string,
  upc: string,
  description: string,
  brand: string | null
) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("kroger_favorite_products").upsert(
    {
      household_id: household.householdId,
      ingredient_name: normalizeIngredientName(ingredientName),
      upc,
      description,
      brand,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,ingredient_name" }
  );
  if (error) return { error: error.message };

  revalidatePath("/shopping/send-to-kroger");
  return {};
}

export async function removeFavoriteProduct(ingredientName: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kroger_favorite_products")
    .delete()
    .eq("household_id", household.householdId)
    .eq("ingredient_name", normalizeIngredientName(ingredientName));
  if (error) return { error: error.message };

  revalidatePath("/shopping/send-to-kroger");
  return {};
}

// "Mark order picked up" — the groceries have actually arrived. Any sent
// row that came from a flagged/restocked Home Stock item flips that item
// back to in-stock, same as checking it off manually would (see
// removeShoppingItem in app/actions/shopping.ts) — Kroger-sent rows skip
// that path since they're deleted here in bulk, not one at a time.
export async function markOrderPickedUp() {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const supabase = await createClient();

  const { data: sentRows, error } = await supabase
    .from("shopping_items")
    .select("id, source_pantry_item_id")
    .eq("household_id", household.householdId)
    .not("sent_at", "is", null);
  if (error) return { error: error.message };

  const sourcePantryItemIds = [
    ...new Set((sentRows ?? []).map((r) => r.source_pantry_item_id as string | null).filter((id): id is string => !!id)),
  ];
  if (sourcePantryItemIds.length > 0) {
    await supabase.from("pantry_items").update({ in_stock: true }).in("id", sourcePantryItemIds);
  }

  await supabase
    .from("shopping_items")
    .delete()
    .eq("household_id", household.householdId)
    .not("sent_at", "is", null);

  revalidatePath("/");
  revalidatePath("/shopping");
  return {};
}
