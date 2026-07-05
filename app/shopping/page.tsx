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
  const core = toItems(coreNames, "core");
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
  const restock: { key: string; label: string; note?: string }[] = [];
  for (const cat of CORE_PANTRY) {
    for (const item of cat.items) {
      const key = `needed:core:${cat.category}:${item}`;
      if (checkedKeys.has(key)) restock.push({ key, label: item, note: cat.category });
    }
  }
  for (const staple of staplesRows ?? []) {
    const key = `needed:staple:${staple.id}`;
    if (checkedKeys.has(key)) restock.push({ key, label: staple.label });
  }

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
