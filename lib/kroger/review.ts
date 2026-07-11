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
  selectedUpc: string | null;
  quantity: number;
  sourceChecklistKey: string | null;
  sourceShoppingItemId: string | null;
};

// Builds the review screen's data: everything currently eligible to send
// (unchecked checklist entries + un-sent shopping_items rows) matched
// against real Kroger products, with an AI-estimated quantity per item.
// Called directly from the (Server Component) review page — not a Server
// Action, since nothing here is triggered by a client-side event.
export async function buildReviewItems(
  supabase: SupabaseClient,
  householdId: string
): Promise<{ items: ReviewItem[] } | { error: string }> {
  const data = await getShoppingListData(supabase, householdId);
  if ("error" in data) return { error: data.error };

  type Eligible = Omit<ReviewItem, "reviewId" | "candidates" | "selectedUpc" | "quantity">;
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

  const candidatesByIndex = await Promise.all(
    eligible.map((item) =>
      searchProduct(item.label, 3).catch(() => [] as KrogerProductMatch[])
    )
  );

  const withIds = eligible.map((item, i) => ({
    ...item,
    reviewId: `item-${i}`,
    candidates: candidatesByIndex[i],
  }));

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
    selectedUpc: item.candidates[0]?.upc ?? null,
    quantity: quantities[item.reviewId] ?? 1,
  }));

  return { items };
}
