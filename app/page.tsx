import { createClient } from "@/lib/supabase/server";
import RecipesBrowser from "@/components/RecipesBrowser";
import type { Recipe, RecipeWithRating, RatingValue } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();

  const [{ data: recipes, error }, { data: userData }] = await Promise.all([
    supabase.from("recipes").select("*").order("name"),
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
  if (userData.user) {
    const { data: ratings } = await supabase
      .from("ratings")
      .select("recipe_id, rating")
      .eq("user_id", userData.user.id);
    ratingsByRecipe = Object.fromEntries(
      (ratings ?? []).map((r) => [r.recipe_id, r.rating as RatingValue])
    );
  }

  const recipesWithRatings: RecipeWithRating[] = (recipes ?? []).map((r) => ({
    ...(r as Recipe),
    rating: ratingsByRecipe[r.id] ?? null,
  }));

  return <RecipesBrowser recipes={recipesWithRatings} />;
}
