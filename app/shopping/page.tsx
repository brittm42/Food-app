import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import ShoppingListView from "@/components/ShoppingListView";
import { CATEGORIES, isFreshCategory } from "@/lib/categories";
import type { Recipe } from "@/lib/types";
import { reconcile } from "@/lib/units";

type ChecklistItem = {
  key: string;
  label: string;
  checked: boolean;
  neededValue?: number | null;
  neededUnit?: string | null;
};
type ShoppingRow = {
  id: string;
  label: string;
  category: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  note: string | null;
};
type CategoryGroup = { category: string; checklist: ChecklistItem[]; shoppingItems: ShoppingRow[] };

export default async function ShoppingPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

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
      .eq("household_id", household.householdId),
    supabase
      .from("pantry_state")
      .select("item_key")
      .eq("household_id", household.householdId),
    supabase.from("pantry_items").select("name, category").eq("household_id", household.householdId),
    supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", household.householdId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pantry_on_hand")
      .select("ingredient_name, quantity_value, quantity_unit")
      .eq("household_id", household.householdId),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the shopping list: {error.message}
      </div>
    );
  }

  const checkedKeys = new Set((checkedRows ?? []).map((r) => r.item_key));

  const onHandByName = new Map(
    (onHandRows ?? []).map((r) => [r.ingredient_name as string, r as { quantity_value: number | null; quantity_unit: string | null }])
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

  type CoreNeed = { value: number; unit: string } | { unreconcilable: true };
  const coreNeeds = new Map<string, CoreNeed>();

  for (const row of queue ?? []) {
    const recipe = row.recipe as unknown as Pick<Recipe, "ingredients" | "servings"> | null;
    const baseServings = recipe?.servings ?? 1;
    const servings = (row.servings_override as number | null) ?? baseServings;
    const ratio = servings / baseServings;

    for (const ing of recipe?.ingredients ?? []) {
      if (!ing.core) {
        freshEntries.set(ing.name, { category: ing.category ?? categoryByKitchenName.get(ing.name.trim().toLowerCase()) ?? "Other" });
        continue;
      }
      coreNames.add(ing.name);

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

  // Recipe-driven Fresh checklist entries, grouped by aisle category.
  const freshGroups = new Map<string, ChecklistItem[]>();
  for (const [name, { category }] of freshEntries) {
    const key = `shopping:fresh:${name}`;
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
    if (!coreGroups.has(category)) coreGroups.set(category, []);
    coreGroups.get(category)!.push({ key, label: name, checked: checkedKeys.has(key), neededValue, neededUnit });
  }

  // shopping_items rows (one-off adds, Kitchen restock/flag pushes) split
  // into Fresh vs. Pantry by their own category, same split as Kitchen.
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

  const fresh = buildSection(freshGroups, freshShoppingItems);
  const pantry = buildSection(coreGroups, pantryShoppingItems);

  return <ShoppingListView fresh={fresh} pantry={pantry} hasQueue={(queue?.length ?? 0) > 0} />;
}
