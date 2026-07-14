import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeItem } from "@/lib/categorize";
import { CATEGORIES, isFreshCategory } from "@/lib/categories";
import type { Recipe } from "@/lib/types";
import { reconcile } from "@/lib/units";

// Shared by both voice entry points (Shortcuts' /api/shopping-items and
// Alexa's /api/alexa/shopping) — neither has a Supabase session, so both
// call this with an admin (service-role) client and an already-resolved
// household_id.
export async function addShoppingItemForHousehold(
  admin: SupabaseClient,
  householdId: string,
  rawLabel: string
): Promise<{ ok: true; label: string; duplicate?: boolean } | { ok: false; error: string }> {
  const label = rawLabel.trim();
  if (!label) {
    return { ok: false, error: "Enter an item name." };
  }

  // A voice add should behave like a real list: saying an item that's
  // already sitting there unchecked is a no-op, not a second row. Escape
  // ilike's own wildcard characters so a literal label like "2% milk" or
  // "family_size chips" doesn't get treated as a pattern.
  const escapedLabel = label.replace(/[%_]/g, (char) => `\\${char}`);

  const { data: existing } = await admin
    .from("shopping_items")
    .select("id")
    .eq("household_id", householdId)
    .ilike("label", escapedLabel)
    .maybeSingle();

  if (existing) {
    return { ok: true, label, duplicate: true };
  }

  const category = await categorizeItem(label);
  const { error } = await admin.from("shopping_items").insert({
    household_id: householdId,
    label,
    category,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, label };
}

type QueueRow = {
  servings_override: number | null;
  recipe: Pick<Recipe, "ingredients" | "servings"> | null;
};

export type CoreNeed = { value: number; unit: string } | { unreconcilable: true };

// Total scaled quantity each core ingredient needs across every queued
// recipe (summing, servings-ratio-scaled, per exact lowercased name) —
// shared by getShoppingListData below and the onboarding wizard's kitchen
// pre-population (lib/kitchen-prepopulate.ts), which needs the same "how
// much does this household actually need" figure to mark common pantry
// basics as already on hand.
export function computeCoreNeeds(queue: QueueRow[]): Map<string, CoreNeed> {
  const coreNeeds = new Map<string, CoreNeed>();

  for (const row of queue) {
    const baseServings = row.recipe?.servings ?? 1;
    const servings = row.servings_override ?? baseServings;
    const ratio = servings / baseServings;

    for (const ing of row.recipe?.ingredients ?? []) {
      if (!ing.core) continue;

      const key = ing.name.trim().toLowerCase();
      const existing = coreNeeds.get(key);
      if (existing && "unreconcilable" in existing) continue;

      if (ing.quantity_value == null || ing.quantity_unit == null) {
        coreNeeds.set(key, { unreconcilable: true });
        continue;
      }
      const scaledValue = ing.quantity_value * ratio;
      if (existing && existing.unit !== ing.quantity_unit) {
        coreNeeds.set(key, { unreconcilable: true });
        continue;
      }
      coreNeeds.set(key, { value: (existing?.value ?? 0) + scaledValue, unit: ing.quantity_unit });
    }
  }

  return coreNeeds;
}

export type ChecklistItem = {
  key: string;
  label: string;
  checked: boolean;
  neededValue?: number | null;
  neededUnit?: string | null;
};
export type ShoppingRow = {
  id: string;
  label: string;
  category: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  note: string | null;
  sentAt: string | null;
  krogerUpc: string | null;
  krogerProductDescription: string | null;
  krogerQuantity: number | null;
};
export type CategoryGroup = { category: string; checklist: ChecklistItem[]; shoppingItems: ShoppingRow[] };
export type ShoppingListData =
  | { error: string }
  | { fresh: CategoryGroup[]; pantry: CategoryGroup[]; hasQueue: boolean };

// The full Shopping List computation: recipe-driven Fresh/Core checklist
// entries (from this week's queue, reconciled against on-hand for Core) plus
// one-off/restock shopping_items rows, both split into Fresh/Pantry sections.
// Shared by app/shopping/page.tsx (renders everything, checked or sent alike)
// and app/shopping/send-to-kroger/page.tsx (filters this down to what's
// still eligible to send).
export async function getShoppingListData(
  supabase: SupabaseClient,
  householdId: string
): Promise<ShoppingListData> {
  const [
    { data: queue, error },
    { data: checkedRows },
    { data: kitchenItems },
    { data: shoppingRows },
    { data: onHandRows },
  ] = await Promise.all([
    supabase
      .from("week_queue")
      .select("servings_override, recipe:recipes(ingredients, servings)")
      .eq("household_id", householdId),
    supabase.from("pantry_state").select("item_key").eq("household_id", householdId),
    supabase.from("pantry_items").select("name, category").eq("household_id", householdId),
    supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pantry_on_hand")
      .select("ingredient_name, quantity_value, quantity_unit")
      .eq("household_id", householdId),
  ]);

  if (error) return { error: error.message };

  const checkedKeys = new Set((checkedRows ?? []).map((r) => r.item_key));

  // Once a checklist item has been sent to Kroger, it's materialized into
  // its own shopping_items row (source_checklist_key set) — that row is now
  // the source of truth for it, so the computed checklist entry must stop
  // reappearing too, or the same ingredient would show up twice (once as an
  // unchecked checklist row, once as the "sent" shopping_items row). The row
  // only exists here while sent-and-not-yet-picked-up; "mark order picked
  // up" deletes it, at which point the checklist entry naturally
  // reappears if it's genuinely still needed.
  const materializedChecklistKeys = new Set(
    (shoppingRows ?? []).map((r) => r.source_checklist_key as string | null).filter((k): k is string => !!k)
  );

  const onHandByName = new Map(
    (onHandRows ?? []).map((r) => [
      r.ingredient_name as string,
      r as { quantity_value: number | null; quantity_unit: string | null },
    ])
  );

  // Every Kitchen item (any provenance) supplies a name -> aisle-category
  // lookup for recipe-driven ingredients that happen to match a catalog
  // item, whether or not that ingredient is core.
  const categoryByKitchenName = new Map<string, string>();
  for (const row of kitchenItems ?? []) {
    categoryByKitchenName.set((row.name as string).trim().toLowerCase(), row.category as string);
  }

  const freshEntries = new Map<string, { category: string }>();
  const coreNames = new Set<string>();

  for (const row of queue ?? []) {
    const recipe = row.recipe as unknown as Pick<Recipe, "ingredients" | "servings"> | null;
    for (const ing of recipe?.ingredients ?? []) {
      if (!ing.core) {
        freshEntries.set(ing.name, {
          category: ing.category ?? categoryByKitchenName.get(ing.name.trim().toLowerCase()) ?? "Other",
        });
      } else {
        coreNames.add(ing.name);
      }
    }
  }

  const coreNeeds = computeCoreNeeds(
    (queue ?? []) as unknown as QueueRow[]
  );

  // Recipe-driven Fresh checklist entries, grouped by aisle category.
  const freshGroups = new Map<string, ChecklistItem[]>();
  for (const [name, { category }] of freshEntries) {
    const key = `shopping:fresh:${name}`;
    if (materializedChecklistKeys.has(key)) continue;
    if (!freshGroups.has(category)) freshGroups.set(category, []);
    freshGroups.get(category)!.push({ key, label: name, checked: checkedKeys.has(key) });
  }

  // Recipe-driven Core reconciliation entries, grouped by aisle category.
  // Pantry reconciliation: drop a core item entirely once on-hand covers
  // what this week's queued recipes need — Shopping List only answers
  // "what do I need to buy," Kitchen answers "what do I have."
  const coreGroups = new Map<string, ChecklistItem[]>();
  for (const name of coreNames) {
    const need = coreNeeds.get(name.trim().toLowerCase());
    const reconcilable = need && !("unreconcilable" in need);
    const neededValue = reconcilable ? (need as { value: number; unit: string }).value : null;
    const neededUnit = reconcilable ? (need as { value: number; unit: string }).unit : null;

    if (neededValue != null && neededUnit != null) {
      const onHand = onHandByName.get(name.trim().toLowerCase());
      const result = reconcile(neededValue, neededUnit, onHand?.quantity_value ?? null, onHand?.quantity_unit ?? null);
      if (result === "have-enough") continue;
    }

    const category = categoryByKitchenName.get(name.trim().toLowerCase()) ?? "Other";
    const key = `shopping:core:${name}`;
    if (materializedChecklistKeys.has(key)) continue;
    if (!coreGroups.has(category)) coreGroups.set(category, []);
    coreGroups.get(category)!.push({ key, label: name, checked: checkedKeys.has(key), neededValue, neededUnit });
  }

  // shopping_items rows (one-off adds, Kitchen restock/flag pushes, and now
  // Kroger-sent materialized checklist items) split into Fresh vs. Pantry
  // by their own category, same split as Kitchen.
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
    pantry: buildSection(coreGroups, pantryShoppingItems),
    hasQueue: (queue?.length ?? 0) > 0,
  };
}
