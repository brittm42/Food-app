import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeItem } from "@/lib/categorize";
import { isFreshCategory } from "@/lib/categories";
import type { Recipe } from "@/lib/types";

// Onboarding-only: gives a brand-new household a starter Home Stock catalog
// based on the shelf-stable ingredients its chosen starter recipes need,
// assumed already in stock (in_stock defaults true) — a new user presumably
// already owns common staples like salt or olive oil. Deliberately NOT
// called on every /kitchen visit (unlike the old core-ingredient
// auto-fold): under the catalog-is-truth reconciliation model
// (lib/shopping.ts), an everyday recipe ingredient that isn't in the
// catalog is supposed to fall through to "not typically stocked" and go
// straight to the Shopping List — silently auto-cataloging it here would
// defeat that distinction.
export async function prepopulatePantryFromStarterRecipes(supabase: SupabaseClient, householdId: string): Promise<void> {
  const [{ data: items }, { data: queue }] = await Promise.all([
    supabase.from("pantry_items").select("name").eq("household_id", householdId),
    supabase
      .from("week_queue")
      .select("recipe:recipes(ingredients)")
      .eq("household_id", householdId),
  ]);

  const catalogNames = new Set((items ?? []).map((i) => (i.name as string).trim().toLowerCase()));

  const newNames = [
    ...new Map(
      (queue ?? []).flatMap((row) => {
        const recipe = row.recipe as unknown as Pick<Recipe, "ingredients"> | null;
        return (recipe?.ingredients ?? [])
          .filter((i) => !isFreshCategory(i.category ?? "Other") && !catalogNames.has(i.name.trim().toLowerCase()))
          .map((i) => [i.name.trim().toLowerCase(), i.name] as const);
      })
    ).values(),
  ];

  if (newNames.length === 0) return;

  const newRows = await Promise.all(
    newNames.map(async (name) => ({
      household_id: householdId,
      name,
      category: await categorizeItem(name),
      item_type: "core" as const,
      in_stock: true,
    }))
  );

  await supabase.from("pantry_items").insert(newRows);
}
