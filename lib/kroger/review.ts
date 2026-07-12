import type { SupabaseClient } from "@supabase/supabase-js";
import { getShoppingListData } from "@/lib/shopping";
import { searchProduct, type KrogerProductMatch } from "@/lib/kroger/products";
import { estimateQuantities } from "@/lib/kroger/estimateQuantity";

export type ReviewItem = {
  reviewId: string;
  label: string;
  category: string;
  section: "fresh" | "pantry";
  neededValue: number | null;
  neededUnit: string | null;
  note: string | null;
  candidates: KrogerProductMatch[];
  searchFailed: boolean;
  selectedUpc: string | null;
  favoriteUpc: string | null;
  quantity: number;
  sourceChecklistKey: string | null;
  sourceShoppingItemId: string | null;
};

function normalizeIngredientName(name: string) {
  return name.trim().toLowerCase();
}

// Builds the review screen's data: everything currently eligible to send
// (unchecked checklist entries + un-sent shopping_items rows) matched
// against real Kroger products, with an AI-estimated quantity per item.
// Called directly from the (Server Component) review page — not a Server
// Action, since nothing here is triggered by a client-side event.
export async function buildReviewItems(
  supabase: SupabaseClient,
  householdId: string,
  locationId: string | null
): Promise<{ items: ReviewItem[] } | { error: string }> {
  const data = await getShoppingListData(supabase, householdId);
  if ("error" in data) return { error: data.error };

  type Eligible = Omit<ReviewItem, "reviewId" | "candidates" | "searchFailed" | "selectedUpc" | "quantity" | "favoriteUpc">;
  const eligible: Eligible[] = [];

  for (const [section, groups] of [
    ["fresh", data.fresh],
    ["pantry", data.pantry],
  ] as const) {
    for (const group of groups) {
      for (const item of group.checklist) {
        if (item.checked) continue;
        eligible.push({
          label: item.label,
          category: group.category,
          section,
          neededValue: item.neededValue ?? null,
          neededUnit: item.neededUnit ?? null,
          note: null,
          sourceChecklistKey: item.key,
          sourceShoppingItemId: null,
        });
      }
      for (const row of group.shoppingItems) {
        if (row.sentAt) continue;
        eligible.push({
          label: row.label,
          category: group.category,
          section,
          neededValue: row.quantityValue,
          neededUnit: row.quantityUnit,
          note: row.note,
          sourceChecklistKey: null,
          sourceShoppingItemId: row.id,
        });
      }
    }
  }

  if (eligible.length === 0) return { items: [] };

  const [candidatesByIndex, { data: favoriteRows }] = await Promise.all([
    Promise.all(
      eligible.map(async (item) => {
        try {
          return { candidates: await searchProduct(item.label, 8, locationId), searchFailed: false };
        } catch (err) {
          // A real API/network failure is a different situation from Kroger
          // genuinely having no match — logged so it's visible in server
          // logs instead of silently looking identical to "no product exists."
          console.error(`Kroger product search failed for "${item.label}":`, err);
          return { candidates: [] as KrogerProductMatch[], searchFailed: true };
        }
      })
    ),
    supabase
      .from("kroger_favorite_products")
      .select("ingredient_name, upc, description, brand")
      .eq("household_id", householdId),
  ]);

  const favoritesByName = new Map(
    (favoriteRows ?? []).map((row) => [
      row.ingredient_name as string,
      { upc: row.upc as string, description: row.description as string, brand: row.brand as string | null },
    ])
  );

  const withIds = eligible.map((item, i) => {
    const favorite = favoritesByName.get(normalizeIngredientName(item.label));
    let candidates = candidatesByIndex[i].candidates;

    // A favorited product might not appear in today's top search results
    // (ranking shifts, discontinued size, etc.) — inject it as a synthetic
    // candidate from the cached description/brand so it's always
    // selectable and always the default, rather than silently falling back
    // to the AI's top pick when the favorite happens to be missing.
    if (favorite && !candidates.some((c) => c.upc === favorite.upc)) {
      candidates = [{ upc: favorite.upc, description: favorite.description, brand: favorite.brand }, ...candidates];
    }

    return {
      ...item,
      reviewId: `item-${i}`,
      candidates,
      searchFailed: candidatesByIndex[i].searchFailed,
      favoriteUpc: favorite?.upc ?? null,
    };
  });

  const quantities = await estimateQuantities(
    withIds.map((item) => ({
      id: item.reviewId,
      label: item.label,
      neededValue: item.neededValue,
      neededUnit: item.neededUnit,
      note: item.note,
      matchedProductDescription: item.candidates[0]?.description ?? null,
    }))
  );

  const items: ReviewItem[] = withIds.map((item) => ({
    ...item,
    selectedUpc: item.favoriteUpc ?? item.candidates[0]?.upc ?? null,
    quantity: quantities[item.reviewId] ?? 1,
  }));

  return { items };
}
