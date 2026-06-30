import { createClient } from "@/lib/supabase/server";
import RecipesBrowser from "@/components/RecipesBrowser";
import type { Recipe, RecipeWithRating, RatingValue, TagColor } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();

  const [{ data: recipes, error }, { data: tagColors }, { data: userData }] = await Promise.all([
    supabase.from("recipes").select("*").order("name"),
    supabase.from("tag_colors").select("*"),
    supabase.auth.getUser(),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load recipes: {error.message}
      </div>
    );
  }

  let ratingsByRecipe: Record<string, RatingValue> = {};
  let queuedRecipeIds = new Set<string>();
  if (userData.user) {
    const [{ data: ratings }, { data: queued }] = await Promise.all([
      supabase
        .from("ratings")
        .select("recipe_id, rating")
        .eq("user_id", userData.user.id),
      supabase
        .from("week_queue")
        .select("recipe_id")
        .eq("user_id", userData.user.id),
    ]);
    ratingsByRecipe = Object.fromEntries(
      (ratings ?? []).map((r) => [r.recipe_id, r.rating as RatingValue])
    );
    queuedRecipeIds = new Set((queued ?? []).map((q) => q.recipe_id));
  }

  const recipesWithRatings: RecipeWithRating[] = (recipes ?? []).map((r) => ({
    ...(r as Recipe),
    rating: ratingsByRecipe[r.id] ?? null,
    queued: queuedRecipeIds.has(r.id),
    editable: userData.user != null,
  }));

  return (
    <RecipesBrowser recipes={recipesWithRatings} tagColors={(tagColors ?? []) as TagColor[]} />
  );
}
