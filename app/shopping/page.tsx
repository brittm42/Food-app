import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import ShoppingListView from "@/components/ShoppingListView";
import { CORE_PANTRY, WEEKLY_FRESH } from "@/lib/types";
import type { Recipe } from "@/lib/types";

export default async function ShoppingPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [
    { data: queue, error },
    { data: checkedRows },
    { data: staplesRows },
    { data: removedRows },
    { data: oneOffRows },
  ] = await Promise.all([
    supabase
      .from("week_queue")
      .select("recipe:recipes(ingredients)")
      .eq("household_id", household.householdId),
    supabase
      .from("pantry_state")
      .select("item_key")
      .eq("household_id", household.householdId),
    supabase
      .from("pantry_staples")
      .select("*")
      .eq("household_id", household.householdId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pantry_catalog_removed")
      .select("item_key")
      .eq("household_id", household.householdId),
    supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", household.householdId)
      .order("created_at", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the shopping list: {error.message}
      </div>
    );
  }

  const checkedKeys = new Set((checkedRows ?? []).map((r) => r.item_key));
  const removedKeys = new Set((removedRows ?? []).map((r) => r.item_key));

  const freshNames = new Set<string>();
  const coreNames = new Set<string>();

  for (const row of queue ?? []) {
    const recipe = row.recipe as unknown as Pick<Recipe, "ingredients"> | null;
    for (const ing of recipe?.ingredients ?? []) {
      (ing.core ? coreNames : freshNames).add(ing.name);
    }
  }

  const toItems = (names: Set<string>, prefix: string) =>
    [...names].sort().map((name) => ({
      key: `shopping:${prefix}:${name}`,
      label: name,
      checked: checkedKeys.has(`shopping:${prefix}:${name}`),
    }));

  const fresh = toItems(freshNames, "fresh");

  // Core Pantry catalog entries carry a parenthetical quantity note baked
  // into the item string (e.g. "Black beans (4 cans)"), while recipe
  // ingredient names are bare per Feature 7's convention (e.g. "Black
  // beans") — strip the suffix to match a queued recipe's "core" ingredient
  // back to its catalog category. Anything with no match (a core-tagged
  // ingredient not in the fixed catalog) falls into "Other" rather than
  // being dropped.
  const stripQty = (item: string) => item.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
  const coreCategoryByName = new Map<string, string>();
  for (const cat of CORE_PANTRY) {
    for (const item of cat.items) coreCategoryByName.set(stripQty(item), cat.category);
  }
  const categoryForCoreName = (name: string) => coreCategoryByName.get(name.trim().toLowerCase()) ?? "Other";

  const coreItems = toItems(coreNames, "core");
  const coreByCategory = new Map<string, typeof coreItems>();
  for (const item of coreItems) {
    const cat = categoryForCoreName(item.label);
    if (!coreByCategory.has(cat)) coreByCategory.set(cat, []);
    coreByCategory.get(cat)!.push(item);
  }
  const core = [...CORE_PANTRY.map((c) => c.category), "Other"]
    .filter((cat) => coreByCategory.has(cat))
    .map((category) => ({ category, items: coreByCategory.get(category)! }));

  const weekly = WEEKLY_FRESH.filter(
    (item) => !removedKeys.has(`catalog:fresh:${item.label}`)
  ).map((item) => ({
    key: `shopping:weekly:${item.label}`,
    label: item.label,
    note: item.note,
    checked: checkedKeys.has(`shopping:weekly:${item.label}`),
  }));

  // Restock: Core Pantry + Staples items flagged "needed" from the Pantry
  // tab. Checking one off here clears the same flag, flipping it back to
  // "in stock" in Pantry (shared pantry_state rows, not a separate list).
  // Grouped by category to match Pantry's own Core Pantry breakdown, with
  // Staples (which have no CORE_PANTRY category) in their own group.
  const restockByCategory = new Map<string, { key: string; label: string }[]>();
  for (const cat of CORE_PANTRY) {
    for (const item of cat.items) {
      const key = `needed:core:${cat.category}:${item}`;
      if (checkedKeys.has(key)) {
        if (!restockByCategory.has(cat.category)) restockByCategory.set(cat.category, []);
        restockByCategory.get(cat.category)!.push({ key, label: item });
      }
    }
  }
  const stapleRestock: { key: string; label: string }[] = [];
  for (const staple of staplesRows ?? []) {
    const key = `needed:staple:${staple.id}`;
    if (checkedKeys.has(key)) stapleRestock.push({ key, label: staple.label });
  }
  if (stapleRestock.length > 0) restockByCategory.set("Staples", stapleRestock);

  const restock = [...CORE_PANTRY.map((c) => c.category), "Staples"]
    .filter((cat) => restockByCategory.has(cat))
    .map((category) => ({ category, items: restockByCategory.get(category)! }));

  const oneOff = (oneOffRows ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    isFood: row.is_food as boolean,
  }));

  return (
    <ShoppingListView
      fresh={fresh}
      core={core}
      weekly={weekly}
      restock={restock}
      oneOff={oneOff}
      hasQueue={(queue?.length ?? 0) > 0}
    />
  );
}
