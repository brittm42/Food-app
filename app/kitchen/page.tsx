import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { computeWeeklyPantryNeeds } from "@/lib/shopping";
import KitchenView from "@/components/KitchenView";

export default async function KitchenPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [{ data: items, error }, { neededByCatalogId }] = await Promise.all([
    supabase.from("pantry_items").select("*").eq("household_id", household.householdId).order("name", { ascending: true }),
    computeWeeklyPantryNeeds(supabase, household.householdId),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load Home Stock: {error.message}
      </div>
    );
  }

  const needed = Object.fromEntries(neededByCatalogId);

  return <KitchenView items={items ?? []} needed={needed} />;
}
