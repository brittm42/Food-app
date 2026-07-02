import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import PantryView from "@/components/PantryView";

export default async function PantryPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const [{ data: checkedRows, error }, { data: staples }] = await Promise.all([
    supabase
      .from("pantry_state")
      .select("item_key")
      .eq("household_id", household.householdId),
    supabase
      .from("pantry_staples")
      .select("*")
      .eq("household_id", household.householdId)
      .order("created_at", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the pantry: {error.message}
      </div>
    );
  }

  const checkedKeys = (checkedRows ?? []).map((r) => r.item_key);

  return <PantryView checkedKeys={checkedKeys} staples={staples ?? []} />;
}
