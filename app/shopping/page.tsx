import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import ShoppingListView from "@/components/ShoppingListView";
import { CATEGORIES } from "@/lib/categories";
import type { Recipe } from "@/lib/types";
import { reconcile } from "@/lib/units";

export default async function ShoppingPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [
    { data: queue, error },
    { data: checkedRows },
    { data: coreCatalog },
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
    supabase
      .from("pantry_items")
      .select("name, category")
      .eq("household_id", household.householdId)
      .eq("item_type", "core"),
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

  const freshNames = new Set<string>();
  const coreNames = new Set<string>();

  // Summed needed quantity per core ingredient this week, keyed by
  // normalized (trim+lowercase) name to match pantry_on_hand's storage
  // convention — kept separate from coreNames (which stays exact-case, the
  // existing display/dedup key) so reconciliation never changes what the
  // list actually shows, only whether an item is included at all. A
  // "poisoned" entry (unreconcilable: true) means some contributing
  // ingredient lacked a clean quantity_value/quantity_unit, or two recipes
  // needed it in incompatible units this week — reconciliation fails open
  // for that ingredient rather than guessing.
  type CoreNeed = { value: number; unit: string } | { unreconcilable: true };
  const coreNeeds = new Map<string, CoreNeed>();

  for (const row of queue ?? []) {
    const recipe = row.recipe as unknown as Pick<Recipe, "ingredients" | "servings"> | null;
    const baseServings = recipe?.servings ?? 1;
    const servings = (row.servings_override as number | null) ?? baseServings;
    const ratio = servings / baseServings;

    for (const ing of recipe?.ingredients ?? []) {
      if (!ing.core) {
        freshNames.add(ing.name);
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
        // Same ingredient needed in incompatible units by two recipes this
        // week — can't sum them, fail open rather than guess.
        coreNeeds.set(key, { unreconcilable: true });
        continue;
      }
      coreNeeds.set(key, { value: (existing?.value ?? 0) + scaledValue, unit: ing.quantity_unit });
    }
  }

  const toItems = (names: Set<string>, prefix: string) =>
    [...names].sort().map((name) => ({
      key: `shopping:${prefix}:${name}`,
      label: name,
      checked: checkedKeys.has(`shopping:${prefix}:${name}`),
    }));

  const fresh = toItems(freshNames, "fresh");

  // Core Pantry catalog now lives in `pantry_items` (item_type: "core") —
  // clean names, real categories, no more parenthetical-quantity stripping
  // needed to match a queued recipe's "core" ingredient back to its
  // category. Anything with no match (a core-tagged ingredient not in the
  // catalog) falls into "Other" rather than being dropped.
  const coreCategoryByName = new Map<string, string>();
  for (const row of coreCatalog ?? []) {
    coreCategoryByName.set((row.name as string).trim().toLowerCase(), row.category as string);
  }
  const categoryForCoreName = (name: string) => coreCategoryByName.get(name.trim().toLowerCase()) ?? "Other";

  // Pantry reconciliation: drop a core item entirely once on-hand covers
  // what this week's queued recipes need — Pantry is where you go to check
  // "what do I have," Shopping List only answers "what do I need to buy."
  // Anything ambiguous (reconcile() returning "unknown") stays listed,
  // same as an item with no on-hand data at all — this feature only ever
  // removes work, never invents false confidence. neededValue/neededUnit
  // ride along on each surviving item so checking it off (toggleCoreItemChecked)
  // knows how much to add back to on-hand.
  const coreItems = toItems(coreNames, "core")
    .map((item) => {
      const need = coreNeeds.get(item.label.trim().toLowerCase());
      const reconcilable = need && !("unreconcilable" in need);
      return {
        ...item,
        neededValue: reconcilable ? (need as { value: number; unit: string }).value : null,
        neededUnit: reconcilable ? (need as { value: number; unit: string }).unit : null,
      };
    })
    .filter((item) => {
      if (item.neededValue == null || item.neededUnit == null) return true;
      const onHand = onHandByName.get(item.label.trim().toLowerCase());
      const result = reconcile(item.neededValue, item.neededUnit, onHand?.quantity_value ?? null, onHand?.quantity_unit ?? null);
      return result !== "have-enough";
    });
  const coreByCategory = new Map<string, typeof coreItems>();
  for (const item of coreItems) {
    const cat = categoryForCoreName(item.label);
    if (!coreByCategory.has(cat)) coreByCategory.set(cat, []);
    coreByCategory.get(cat)!.push(item);
  }
  const core = CATEGORIES.filter((cat) => coreByCategory.has(cat)).map((category) => ({
    category,
    items: coreByCategory.get(category)!,
  }));

  // Everything else on the list — one-off adds and Pantry restock/add-to-
  // list taps are indistinguishable here, both are just shopping_items
  // rows — grouped by their auto-assigned aisle category instead of a
  // single bottom catch-all section.
  const itemsByCategory = new Map<string, { id: string; label: string; category: string; quantityValue: number | null; quantityUnit: string | null }[]>();
  for (const row of shoppingRows ?? []) {
    const cat = row.category as string;
    if (!itemsByCategory.has(cat)) itemsByCategory.set(cat, []);
    itemsByCategory.get(cat)!.push({
      id: row.id as string,
      label: row.label as string,
      category: cat,
      quantityValue: row.quantity_value as number | null,
      quantityUnit: row.quantity_unit as string | null,
    });
  }
  const items = CATEGORIES.filter((cat) => itemsByCategory.has(cat)).map((category) => ({
    category,
    items: itemsByCategory.get(category)!,
  }));

  return (
    <ShoppingListView
      fresh={fresh}
      core={core}
      items={items}
      hasQueue={(queue?.length ?? 0) > 0}
    />
  );
}
