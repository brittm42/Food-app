import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getAuthClaims } from "@/lib/auth";
import { computeWeeklyPantryNeeds } from "@/lib/shopping";
import LandingPage from "@/components/LandingPage";
import KitchenView from "@/components/KitchenView";

// Root is whichever nav item is ordered first (components/TopNav.tsx) —
// currently Home Stock. Also doubles as the signed-out marketing landing
// page, same as when Recipes lived here.
export default async function HomePage() {
  const claims = await getAuthClaims();
  if (!claims) {
    return <LandingPage />;
  }

  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return null;

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
