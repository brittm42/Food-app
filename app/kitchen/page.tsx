import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { categorizeItem } from "@/lib/categorize";
import { isFreshCategory } from "@/lib/categories";
import KitchenView from "@/components/KitchenView";
import type { Recipe } from "@/lib/types";

export default async function KitchenPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [{ data: items, error }, { data: onHandRows }, { data: queue }, { data: sentPantryIds }] = await Promise.all([
    supabase
      .from("pantry_items")
      .select("*")
      .eq("household_id", household.householdId)
      .order("name", { ascending: true }),
    supabase
      .from("pantry_on_hand")
      .select("ingredient_name, quantity_value, quantity_unit")
      .eq("household_id", household.householdId),
    supabase
      .from("week_queue")
      .select("recipe:recipes(ingredients)")
      .eq("household_id", household.householdId),
    supabase
      .from("shopping_items")
      .select("source_pantry_item_id")
      .eq("household_id", household.householdId)
      .not("source_pantry_item_id", "is", null),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the kitchen: {error.message}
      </div>
    );
  }

  let allItems = items ?? [];
  const catalogNames = new Set(allItems.map((i) => (i.name as string).trim().toLowerCase()));
  const onHandByName = new Map(
    (onHandRows ?? []).map((r) => [r.ingredient_name as string, r as { quantity_value: number | null; quantity_unit: string | null }])
  );

  // Every core-tagged ingredient touched by a queued recipe this week that
  // isn't already a Kitchen item becomes a real pantry_items row (Fresh vs.
  // Pantry falls out of its auto-detected category, same as any other new
  // item) — replaces the old ad-hoc "Other Core Ingredients" section that
  // showed these without ever adding them to the catalog for real.
  const newCoreNames = [
    ...new Set(
      (queue ?? []).flatMap((row) => {
        const recipe = row.recipe as unknown as Pick<Recipe, "ingredients"> | null;
        return (recipe?.ingredients ?? [])
          .filter((i) => i.core && !catalogNames.has(i.name.trim().toLowerCase()))
          .map((i) => i.name);
      })
    ),
  ];

  if (newCoreNames.length > 0) {
    const newRows = await Promise.all(
      newCoreNames.map(async (name) => {
        const category = await categorizeItem(name);
        const onHand = onHandByName.get(name.trim().toLowerCase());
        return {
          household_id: household.householdId,
          name,
          category,
          item_type: "core" as const,
          on_hand_qty: isFreshCategory(category) ? null : (onHand?.quantity_value ?? null),
          on_hand_unit: isFreshCategory(category) ? null : (onHand?.quantity_unit ?? null),
        };
      })
    );
    const { data: inserted } = await supabase.from("pantry_items").insert(newRows).select("*");
    if (inserted) allItems = [...allItems, ...inserted];
  }

  const onShoppingListIds = new Set(
    (sentPantryIds ?? []).map((row) => row.source_pantry_item_id as string)
  );

  return <KitchenView items={allItems} onShoppingListIds={[...onShoppingListIds]} />;
}
