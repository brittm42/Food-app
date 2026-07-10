import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import PantryView from "@/components/PantryView";
import type { Recipe } from "@/lib/types";

export default async function PantryPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [{ data: items, error }, { data: onHandRows }, { data: queue }] = await Promise.all([
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
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the pantry: {error.message}
      </div>
    );
  }

  const coreCatalogNames = new Set(
    (items ?? []).filter((i) => i.item_type === "core").map((i) => (i.name as string).trim().toLowerCase())
  );

  // Every core-tagged ingredient touched by a queued recipe this week that
  // isn't already a Core Pantry catalog item, so Pantry can still offer an
  // on-hand control for it (PantryView's "Other Core Ingredients" section).
  const otherCoreNames = [
    ...new Set(
      (queue ?? []).flatMap((row) => {
        const recipe = row.recipe as unknown as Pick<Recipe, "ingredients"> | null;
        return (recipe?.ingredients ?? [])
          .filter((i) => i.core && !coreCatalogNames.has(i.name.trim().toLowerCase()))
          .map((i) => i.name);
      })
    ),
  ].sort();

  return <PantryView items={items ?? []} otherCoreNames={otherCoreNames} otherCoreOnHand={onHandRows ?? []} />;
}
