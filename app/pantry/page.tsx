import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import PantryView from "@/components/PantryView";
import type { Recipe } from "@/lib/types";

export default async function PantryPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [
    { data: checkedRows, error },
    { data: staples },
    { data: removedRows },
    { data: onHandRows },
    { data: queue },
  ] = await Promise.all([
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

  const checkedKeys = (checkedRows ?? []).map((r) => r.item_key);
  const removedKeys = (removedRows ?? []).map((r) => r.item_key);

  // Every core-tagged ingredient touched by a queued recipe this week, so
  // Pantry can offer an on-hand control even for ingredients outside the
  // fixed CORE_PANTRY catalog (PantryView sorts out which ones already
  // have a catalog match vs. need the "Other core ingredients" section).
  const queuedCoreNames = [
    ...new Set(
      (queue ?? []).flatMap((row) => {
        const recipe = row.recipe as unknown as Pick<Recipe, "ingredients"> | null;
        return (recipe?.ingredients ?? []).filter((i) => i.core).map((i) => i.name);
      })
    ),
  ].sort();

  return (
    <PantryView
      checkedKeys={checkedKeys}
      staples={staples ?? []}
      removedKeys={removedKeys}
      onHand={onHandRows ?? []}
      queuedCoreNames={queuedCoreNames}
    />
  );
}
