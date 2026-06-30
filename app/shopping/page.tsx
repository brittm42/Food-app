import { createClient } from "@/lib/supabase/server";
import ShoppingListView from "@/components/ShoppingListView";
import { WEEKLY_FRESH } from "@/lib/types";
import type { Recipe } from "@/lib/types";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: queue, error }, { data: checkedRows }] = await Promise.all([
    supabase
      .from("week_queue")
      .select("recipe:recipes(ingredients)")
      .eq("user_id", userData.user.id),
    supabase
      .from("pantry_state")
      .select("item_key")
      .eq("user_id", userData.user.id),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the shopping list: {error.message}
      </div>
    );
  }

  const checkedKeys = new Set((checkedRows ?? []).map((r) => r.item_key));

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
  const weekly = WEEKLY_FRESH.map((item) => ({
    key: `shopping:weekly:${item.label}`,
    label: item.label,
    note: item.note,
    checked: checkedKeys.has(`shopping:weekly:${item.label}`),
  }));

  return (
    <ShoppingListView
      fresh={fresh}
      core={core}
      weekly={weekly}
      hasQueue={(queue?.length ?? 0) > 0}
    />
  );
}
