import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import ThisWeekView from "@/components/ThisWeekView";
import type { Recipe } from "@/lib/types";

export default async function ThisWeekPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();

  const { data: queue, error } = await supabase
    .from("week_queue")
    .select("id, servings_override, recipe:recipes(*)")
    .eq("household_id", household.householdId)
    .order("added_at");

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load This Week: {error.message}
      </div>
    );
  }

  const items = (queue ?? []).map((q) => ({
    queueId: q.id as string,
    servingsOverride: q.servings_override as number | null,
    recipe: q.recipe as unknown as Recipe,
  }));

  return <ThisWeekView items={items} />;
}
