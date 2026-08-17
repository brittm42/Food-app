import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeItem } from "@/lib/categorize";
import { CATEGORIES, isFreshCategory } from "@/lib/categories";
import { parseVoiceItemQuantity } from "@/lib/parse-voice-quantity";
import type { Recipe } from "@/lib/types";

// Shared by both voice entry points (Shortcuts' /api/shopping-items and
// Alexa's /api/alexa/shopping) — neither has a Supabase session, so both
// call this with an admin (service-role) client and an already-resolved
// household_id.
export async function addShoppingItemForHousehold(
  admin: SupabaseClient,
  householdId: string,
  rawLabel: string
): Promise<{ ok: true; label: string; duplicate?: boolean; linkedToPantryItem?: boolean } | { ok: false; error: string }> {
  if (!rawLabel.trim()) {
    return { ok: false, error: "Enter an item name." };
  }

  // Strip any spoken quantity/unit ("2 bags of Tostitos bites") before
  // dedup/catalog matching runs, so the fuzzy-match logic below compares
  // against the clean item name, not the raw phrase.
  const spoken = await parseVoiceItemQuantity(rawLabel);
  const label = spoken.label;
  if (!label) {
    return { ok: false, error: "Enter an item name." };
  }

  // A voice add should behave like a real list: saying an item that's
  // already sitting there unchecked is a no-op, not a second row. Fuzzy —
  // catches near-duplicates like "Spaghetti Os" vs. "SpaghettiOs" — not
  // just an exact/case-insensitive match.
  const { data: existingItems } = await admin.from("shopping_items").select("id, label").eq("household_id", householdId);
  const existing = (existingItems ?? []).find((row) => isFuzzyDuplicate(row.label as string, label));

  if (existing) {
    return { ok: true, label, duplicate: true };
  }

  // Match against the household's own Home Stock catalog — if this is
  // something already tracked there, link the new row to it (same loop the
  // Kitchen restock button uses: checking it off flips the catalog item
  // back to in-stock) and default to its usual purchase quantity instead of
  // adding a bare, unquantified item.
  const { data: catalogItems } = await admin
    .from("pantry_items")
    .select("id, name, category, target_qty, target_unit")
    .eq("household_id", householdId);
  const catalogMatch = (catalogItems ?? []).find((row) => isFuzzyDuplicate(row.name as string, label));

  // An explicit spoken quantity ("2 bags of...") takes priority over the
  // catalog's usual purchase amount; only fall back to the catalog default
  // when nothing was said.
  let quantityValue: number | null;
  let quantityUnit: string | null;
  if (spoken.quantityValue != null) {
    quantityValue = spoken.quantityValue;
    quantityUnit = spoken.quantityUnit;
  } else {
    quantityValue = catalogMatch?.target_qty ?? null;
    quantityUnit = quantityValue != null ? (catalogMatch?.target_unit ?? null) : null;
  }

  const category = catalogMatch ? (catalogMatch.category as string) : await categorizeItem(label);
  const { error } = await admin.from("shopping_items").insert({
    household_id: householdId,
    label: catalogMatch ? (catalogMatch.name as string) : label,
    category,
    quantity_value: quantityValue,
    quantity_unit: quantityUnit,
    source_pantry_item_id: catalogMatch?.id ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Same "need it" semantics as tapping "Need to buy" on the Home Stock
  // item directly — keeps its in-stock status consistent with it now being
  // on the Shopping List.
  if (catalogMatch) {
    await admin.from("pantry_items").update({ in_stock: false }).eq("id", catalogMatch.id);
  }

  return { ok: true, label, linkedToPantryItem: !!catalogMatch };
}

// Loose near-duplicate check for voice-add dedup/catalog-matching: case-
// insensitive, ignoring whitespace and punctuation (so "Spaghetti Os" and
// "SpaghettiOs" match, and "2% milk" doesn't choke on the %). Deliberately
// not a full fuzzy-distance algorithm — this app's items are short grocery
// nouns, where "strip non-letters and compare" catches the realistic near-
// duplicates (spacing, punctuation, capitalization) without the false-
// positive risk of edit-distance matching two genuinely different short
// words.
function normalizeForFuzzyMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isFuzzyDuplicate(a: string, b: string): boolean {
  const normalizedA = normalizeForFuzzyMatch(a);
  const normalizedB = normalizeForFuzzyMatch(b);
  return !!normalizedA && normalizedA === normalizedB;
}

type QueueRow = {
  servings_override: number | null;
  recipe: Pick<Recipe, "ingredients" | "servings"> | null;
};

export type IngredientNeed = { value: number; unit: string } | { unreconcilable: true };

// Total scaled quantity each ingredient needs across every queued recipe
// (summing, servings-ratio-scaled, per exact lowercased name) — shared by
// getShoppingListData/computeWeeklyPantryNeeds below.
export function computeIngredientNeeds(queue: QueueRow[]): Map<string, IngredientNeed> {
  const needs = new Map<string, IngredientNeed>();

  for (const row of queue) {
    const baseServings = row.recipe?.servings ?? 1;
    const servings = row.servings_override ?? baseServings;
    const ratio = servings / baseServings;

    for (const ing of row.recipe?.ingredients ?? []) {
      const key = ing.name.trim().toLowerCase();
      const existing = needs.get(key);
      if (existing && "unreconcilable" in existing) continue;

      if (ing.quantity_value == null || ing.quantity_unit == null) {
        needs.set(key, { unreconcilable: true });
        continue;
      }
      const scaledValue = ing.quantity_value * ratio;
      if (existing && existing.unit !== ing.quantity_unit) {
        needs.set(key, { unreconcilable: true });
        continue;
      }
      needs.set(key, { value: (existing?.value ?? 0) + scaledValue, unit: ing.quantity_unit });
    }
  }

  return needs;
}

export type CatalogItemInfo = {
  name: string;
  category: string;
  inStock: boolean;
  targetQty: number | null;
  targetUnit: string | null;
};

export type WeeklyPantryNeeds = {
  // This week's computed need for a matched (already-in-catalog) Pantry
  // item, keyed by pantry_items.id — for Home Stock's "need ~X this week"
  // badge.
  neededByCatalogId: Map<string, { value: number | null; unit: string | null }>;
  // Shelf-stable recipe ingredients that don't match anything in the
  // household's Home Stock catalog — "not typically stocked."
  unmatched: { name: string; category: string; value: number | null; unit: string | null }[];
  catalogById: Map<string, CatalogItemInfo>;
};

// Matches this week's queued recipes' shelf-stable ingredients against the
// household's own Home Stock catalog by name — the catalog (not a recipe-
// authored "core" flag) is the source of truth for what's routine. Fresh-
// category ingredients are never matched here; they're always on the
// unconditional "Buy Fresh" checklist regardless of catalog state.
export async function computeWeeklyPantryNeeds(supabase: SupabaseClient, householdId: string): Promise<WeeklyPantryNeeds> {
  const [{ data: queue }, { data: catalogItems }] = await Promise.all([
    supabase
      .from("week_queue")
      .select("servings_override, recipe:recipes(ingredients, servings)")
      .eq("household_id", householdId),
    supabase.from("pantry_items").select("id, name, category, in_stock, target_qty, target_unit").eq("household_id", householdId),
  ]);

  const queueRows = (queue ?? []) as unknown as QueueRow[];
  const needs = computeIngredientNeeds(queueRows);

  const shelfStable = new Map<string, { displayName: string; category: string }>();
  for (const row of queueRows) {
    for (const ing of row.recipe?.ingredients ?? []) {
      const category = ing.category ?? "Other";
      if (isFreshCategory(category)) continue;
      const key = ing.name.trim().toLowerCase();
      if (!shelfStable.has(key)) shelfStable.set(key, { displayName: ing.name, category });
    }
  }

  const catalogById = new Map<string, CatalogItemInfo>();
  const catalogIdByName = new Map<string, string>();
  for (const row of catalogItems ?? []) {
    const id = row.id as string;
    catalogById.set(id, {
      name: row.name as string,
      category: row.category as string,
      inStock: row.in_stock as boolean,
      targetQty: row.target_qty as number | null,
      targetUnit: row.target_unit as string | null,
    });
    catalogIdByName.set((row.name as string).trim().toLowerCase(), id);
  }

  const neededByCatalogId = new Map<string, { value: number | null; unit: string | null }>();
  const unmatched: WeeklyPantryNeeds["unmatched"] = [];

  for (const [key, { displayName, category }] of shelfStable) {
    const need = needs.get(key);
    const value = need && !("unreconcilable" in need) ? need.value : null;
    const unit = need && !("unreconcilable" in need) ? need.unit : null;

    const catalogId = catalogIdByName.get(key);
    if (catalogId) {
      neededByCatalogId.set(catalogId, { value, unit });
    } else {
      unmatched.push({ name: displayName, category, value, unit });
    }
  }

  return { neededByCatalogId, unmatched, catalogById };
}

// Ensures the Shopping List reflects what this week's queued recipes
// actually require, beyond what's already flagged manually: a shelf-stable
// ingredient with no Home Stock match at all goes straight onto the list
// (flagged recipe_driven, distinct from a regular add); one that matches a
// catalog item already flagged "need to buy" gets a row too, in case it
// somehow doesn't have one yet, sized to whichever is bigger — the usual
// amount or this week's need. Matched-and-in-stock items are left alone
// entirely (Home Stock shows the need as an FYI badge instead — see
// computeWeeklyPantryNeeds). Also cleans up recipe_driven rows for
// ingredients that are no longer needed (e.g. the recipe was dropped from
// This Week), as long as they haven't already been sent to Kroger.
export async function syncWeeklyNeedsToShoppingList(supabase: SupabaseClient, householdId: string): Promise<void> {
  const { neededByCatalogId, unmatched, catalogById } = await computeWeeklyPantryNeeds(supabase, householdId);

  const { data: existingRows } = await supabase
    .from("shopping_items")
    .select("id, source_pantry_item_id, source_checklist_key, recipe_driven, sent_at")
    .eq("household_id", householdId);

  const existingByPantryId = new Set(
    (existingRows ?? []).filter((r) => r.source_pantry_item_id).map((r) => r.source_pantry_item_id as string)
  );
  const existingChecklistKeys = new Set(
    (existingRows ?? []).filter((r) => r.source_checklist_key).map((r) => r.source_checklist_key as string)
  );

  const toInsert: Record<string, unknown>[] = [];

  for (const [catalogId, need] of neededByCatalogId) {
    const catalogItem = catalogById.get(catalogId);
    if (!catalogItem || catalogItem.inStock) continue;
    if (existingByPantryId.has(catalogId)) continue;

    const preferNeeded =
      need.value != null && (catalogItem.targetQty == null || need.unit !== catalogItem.targetUnit || need.value > catalogItem.targetQty);
    const quantityValue = preferNeeded ? need.value : catalogItem.targetQty;
    const quantityUnit = preferNeeded ? need.unit : catalogItem.targetUnit;

    toInsert.push({
      household_id: householdId,
      label: catalogItem.name,
      category: catalogItem.category,
      quantity_value: quantityValue,
      quantity_unit: quantityValue != null ? quantityUnit : null,
      source_pantry_item_id: catalogId,
    });
  }

  const currentUnmatchedKeys = new Set<string>();
  for (const item of unmatched) {
    const key = `weekneed:${item.name.trim().toLowerCase()}`;
    currentUnmatchedKeys.add(key);
    if (existingChecklistKeys.has(key)) continue;

    toInsert.push({
      household_id: householdId,
      label: item.name,
      category: item.category,
      quantity_value: item.value,
      quantity_unit: item.value != null ? item.unit : null,
      source_checklist_key: key,
      recipe_driven: true,
    });
  }

  if (toInsert.length > 0) {
    await supabase.from("shopping_items").insert(toInsert);
  }

  const staleRowIds = (existingRows ?? [])
    .filter(
      (r) =>
        r.recipe_driven &&
        !r.sent_at &&
        typeof r.source_checklist_key === "string" &&
        (r.source_checklist_key as string).startsWith("weekneed:") &&
        !currentUnmatchedKeys.has(r.source_checklist_key as string)
    )
    .map((r) => r.id as string);

  if (staleRowIds.length > 0) {
    await supabase.from("shopping_items").delete().in("id", staleRowIds);
  }
}

export type ChecklistItem = { key: string; label: string; checked: boolean };
export type ShoppingRow = {
  id: string;
  label: string;
  category: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  note: string | null;
  recipeDriven: boolean;
  sentAt: string | null;
  krogerUpc: string | null;
  krogerProductDescription: string | null;
  krogerQuantity: number | null;
};
export type CategoryGroup = { category: string; checklist: ChecklistItem[]; shoppingItems: ShoppingRow[] };
export type ShoppingListData =
  | { error: string }
  | { fresh: CategoryGroup[]; pantry: CategoryGroup[]; hasQueue: boolean };

// The full Shopping List computation: the recipe-driven "Buy Fresh"
// checklist (unconditional — perishables are always bought weekly
// regardless of Home Stock state) plus every shopping_items row (one-off
// adds, Kitchen restock/flag pushes, and the auto-synced recipe-driven
// rows from syncWeeklyNeedsToShoppingList), split into Fresh/Pantry
// sections by category. Shared by app/shopping/page.tsx (renders
// everything, checked or sent alike) and app/shopping/send-to-kroger/page.tsx
// (filters this down to what's still eligible to send).
export async function getShoppingListData(supabase: SupabaseClient, householdId: string): Promise<ShoppingListData> {
  const [{ data: queue, error }, { data: checkedRows }, { data: kitchenItems }, { data: shoppingRows }] = await Promise.all([
    supabase
      .from("week_queue")
      .select("servings_override, recipe:recipes(ingredients, servings)")
      .eq("household_id", householdId),
    supabase.from("pantry_state").select("item_key").eq("household_id", householdId),
    supabase.from("pantry_items").select("name, category").eq("household_id", householdId),
    supabase.from("shopping_items").select("*").eq("household_id", householdId).order("created_at", { ascending: true }),
  ]);

  if (error) return { error: error.message };

  const checkedKeys = new Set((checkedRows ?? []).map((r) => r.item_key));

  // Once a checklist item has been sent to Kroger, it's materialized into
  // its own shopping_items row (source_checklist_key set) — that row is now
  // the source of truth for it, so the computed checklist entry must stop
  // reappearing too. The row only exists here while sent-and-not-yet-picked-
  // up; "mark order picked up" deletes it, at which point the checklist
  // entry naturally reappears if it's genuinely still needed.
  const materializedChecklistKeys = new Set(
    (shoppingRows ?? []).map((r) => r.source_checklist_key as string | null).filter((k): k is string => !!k)
  );

  const categoryByKitchenName = new Map<string, string>();
  for (const row of kitchenItems ?? []) {
    categoryByKitchenName.set((row.name as string).trim().toLowerCase(), row.category as string);
  }

  const freshEntries = new Map<string, { category: string }>();
  for (const row of (queue ?? []) as unknown as QueueRow[]) {
    for (const ing of row.recipe?.ingredients ?? []) {
      const category = ing.category ?? categoryByKitchenName.get(ing.name.trim().toLowerCase()) ?? "Other";
      if (isFreshCategory(category)) {
        freshEntries.set(ing.name, { category });
      }
    }
  }

  const freshGroups = new Map<string, ChecklistItem[]>();
  for (const [name, { category }] of freshEntries) {
    const key = `shopping:fresh:${name}`;
    if (materializedChecklistKeys.has(key)) continue;
    if (!freshGroups.has(category)) freshGroups.set(category, []);
    freshGroups.get(category)!.push({ key, label: name, checked: checkedKeys.has(key) });
  }

  // shopping_items rows (one-off adds, Kitchen restock/flag pushes, recipe-
  // driven auto-adds, and Kroger-sent materialized items) split into Fresh
  // vs. Pantry by their own category, same split as Home Stock.
  const freshShoppingItems = new Map<string, ShoppingRow[]>();
  const pantryShoppingItems = new Map<string, ShoppingRow[]>();
  for (const row of shoppingRows ?? []) {
    const cat = row.category as string;
    const bucket = isFreshCategory(cat) ? freshShoppingItems : pantryShoppingItems;
    if (!bucket.has(cat)) bucket.set(cat, []);
    bucket.get(cat)!.push({
      id: row.id as string,
      label: row.label as string,
      category: cat,
      quantityValue: row.quantity_value as number | null,
      quantityUnit: row.quantity_unit as string | null,
      note: row.note as string | null,
      recipeDriven: (row.recipe_driven as boolean) ?? false,
      sentAt: row.sent_at as string | null,
      krogerUpc: row.kroger_upc as string | null,
      krogerProductDescription: row.kroger_product_description as string | null,
      krogerQuantity: row.kroger_quantity as number | null,
    });
  }

  const buildSection = (
    checklistByCategory: Map<string, ChecklistItem[]>,
    shoppingByCategory: Map<string, ShoppingRow[]>
  ): CategoryGroup[] => {
    const categories = new Set([...checklistByCategory.keys(), ...shoppingByCategory.keys()]);
    return CATEGORIES.filter((c) => categories.has(c)).map((category) => ({
      category,
      checklist: (checklistByCategory.get(category) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
      shoppingItems: shoppingByCategory.get(category) ?? [],
    }));
  };

  return {
    fresh: buildSection(freshGroups, freshShoppingItems),
    pantry: buildSection(new Map(), pantryShoppingItems),
    hasQueue: (queue?.length ?? 0) > 0,
  };
}
