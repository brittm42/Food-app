import { createClient } from "@/lib/supabase/server";
import RecipesBrowser from "@/components/RecipesBrowser";
import type { Recipe } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("name");

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load recipes: {error.message}
      </div>
    );
  }

  return <RecipesBrowser recipes={(data ?? []) as Recipe[]} />;
}
