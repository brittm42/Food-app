import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { prepopulateCoreIngredients } from "@/lib/kitchen-prepopulate";
import KitchenView from "@/components/KitchenView";

export default async function KitchenPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  // Every core-tagged ingredient touched by a queued recipe this week that
  // isn't already a Kitchen item becomes a real pantry_items row (Fresh vs.
  // Pantry falls out of its auto-detected category, same as any other new
  // item) — replaces the old ad-hoc "Other Core Ingredients" section that
  // showed these without ever adding them to the catalog for real.
  await prepopulateCoreIngredients(supabase, household.householdId);

  const [{ data: items, error }, { data: sentPantryIds }] = await Promise.all([
    supabase
      .from("pantry_items")
      .select("*")
      .eq("household_id", household.householdId)
      .order("name", { ascending: true }),
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

  const allItems = items ?? [];

  const onShoppingListIds = new Set(
    (sentPantryIds ?? []).map((row) => row.source_pantry_item_id as string)
  );

  return <KitchenView items={allItems} onShoppingListIds={[...onShoppingListIds]} />;
}
