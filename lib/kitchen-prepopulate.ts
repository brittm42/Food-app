import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeItem } from "@/lib/categorize";
import { isFreshCategory } from "@/lib/categories";
import { computeCoreNeeds } from "@/lib/shopping";
import type { Recipe } from "@/lib/types";

// Shared by app/kitchen/page.tsx (lazy, on-visit) and the onboarding
// wizard's finishOnboarding() (eager, right after starter recipes land in
// week_queue) — inserts a real pantry_items row for every core-tagged
// ingredient across the household's queued recipes that isn't already a
// Kitchen item.
export async function prepopulateCoreIngredients(
  supabase: SupabaseClient,
  householdId: string,
  options: { assumeStocked?: boolean } = {}
): Promise<void> {
  const [{ data: items }, { data: onHandRows }, { data: queue }] = await Promise.all([
    supabase.from("pantry_items").select("name").eq("household_id", householdId),
    supabase
      .from("pantry_on_hand")
      .select("ingredient_name, quantity_value, quantity_unit")
      .eq("household_id", householdId),
    supabase
      .from("week_queue")
      .select("servings_override, recipe:recipes(ingredients, servings)")
      .eq("household_id", householdId),
  ]);

  const catalogNames = new Set((items ?? []).map((i) => (i.name as string).trim().toLowerCase()));
  const onHandByName = new Map(
    (onHandRows ?? []).map((r) => [
      r.ingredient_name as string,
      r as { quantity_value: number | null; quantity_unit: string | null },
    ])
  );

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

  if (newCoreNames.length === 0) return;

  // Onboarding's "assume common pantry basics are already on hand" — set
  // on-hand to exactly what this week's starter recipes need (same value +
  // unit computeCoreNeeds derives, the same figure the Shopping List
  // reconciles against), so reconcile() reads "have-enough" and the item
  // doesn't show up needing a purchase. The everyday /kitchen page never
  // does this (assumeStocked defaults false) — it only ever seeds on-hand
  // from a genuine pre-existing pantry_on_hand match, same as before.
  const coreNeeds = options.assumeStocked
    ? computeCoreNeeds(
        (queue ?? []) as unknown as Parameters<typeof computeCoreNeeds>[0]
      )
    : null;

  const newRows = await Promise.all(
    newCoreNames.map(async (name) => {
      const category = await categorizeItem(name);
      const fresh = isFreshCategory(category);
      const key = name.trim().toLowerCase();
      const onHand = onHandByName.get(key);
      const need = coreNeeds?.get(key);
      const assumedStock = !fresh && need && !("unreconcilable" in need) ? need : null;

      return {
        household_id: householdId,
        name,
        category,
        item_type: "core" as const,
        on_hand_qty: fresh ? null : (onHand?.quantity_value ?? assumedStock?.value ?? null),
        on_hand_unit: fresh ? null : (onHand?.quantity_unit ?? assumedStock?.unit ?? null),
      };
    })
  );

  const { data: inserted } = await supabase.from("pantry_items").insert(newRows).select("id, name");

  // pantry_on_hand mirrors pantry_items.on_hand_qty/unit keyed by ingredient
  // name (same dual-write updatePantryOnHand does) — the Shopping List's
  // reconciliation reads pantry_on_hand, not pantry_items, so both need the
  // assumed-stocked value or the item would still show as needed there.
  if (options.assumeStocked && inserted) {
    const onHandUpserts = inserted
      .map((row) => {
        const need = coreNeeds?.get((row.name as string).trim().toLowerCase());
        if (!need || "unreconcilable" in need) return null;
        return {
          household_id: householdId,
          ingredient_name: (row.name as string).trim().toLowerCase(),
          quantity_value: need.value,
          quantity_unit: need.unit,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (onHandUpserts.length > 0) {
      await supabase.from("pantry_on_hand").upsert(onHandUpserts, { onConflict: "household_id,ingredient_name" });
    }
  }
}
