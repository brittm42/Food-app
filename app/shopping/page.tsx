import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getShoppingListData, syncWeeklyNeedsToShoppingList } from "@/lib/shopping";
import { getKrogerConnectionStatus } from "@/app/actions/kroger";
import ShoppingListView from "@/components/ShoppingListView";

export default async function ShoppingPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  // Materializes this week's recipe-driven needs onto the Shopping List
  // before reading it — a not-typically-stocked ingredient gets a real row,
  // an already-flagged routine item gets its quantity sized up if needed.
  await syncWeeklyNeedsToShoppingList(supabase, household.householdId);

  const [data, krogerStatus] = await Promise.all([
    getShoppingListData(supabase, household.householdId),
    getKrogerConnectionStatus(),
  ]);

  if ("error" in data) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the shopping list: {data.error}
      </div>
    );
  }

  const allGroups = [...data.fresh, ...data.pantry];
  const hasEligibleItems = allGroups.some(
    (g) =>
      g.checklist.some((c) => !c.checked) || g.shoppingItems.some((s) => !s.sentAt)
  );
  const hasSentItems = allGroups.some((g) => g.shoppingItems.some((s) => s.sentAt));

  return (
    <ShoppingListView
      fresh={data.fresh}
      pantry={data.pantry}
      hasQueue={data.hasQueue}
      krogerConnected={krogerStatus.connected}
      hasEligibleItems={hasEligibleItems}
      hasSentItems={hasSentItems}
    />
  );
}
