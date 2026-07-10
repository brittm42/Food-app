import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import RecipesBrowser from "@/components/RecipesBrowser";
import LandingPage from "@/components/LandingPage";
import type { Recipe, RecipeWithRating, RatingValue, TagColor } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <LandingPage />;
  }

  const [{ data: recipes, error }, { data: tagColors }, household] =
    await Promise.all([
      supabase.from("recipes").select("*").order("name"),
      supabase.from("tag_colors").select("*"),
      getCurrentHousehold(),
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
  let pickedFlavorIds: string[] = [];
  if (userData.user) {
    const [{ data: ratings }, { data: queued }, { data: picks }] = await Promise.all([
      supabase
        .from("ratings")
        .select("recipe_id, rating")
        .eq("user_id", userData.user.id),
      household
        ? supabase
            .from("week_queue")
            .select("recipe_id")
            .eq("household_id", household.householdId)
        : Promise.resolve({ data: [] as { recipe_id: string }[] }),
      supabase
        .from("oat_picks")
        .select("flavor_id")
        .eq("user_id", userData.user.id)
        .order("picked_at", { ascending: true }),
    ]);
    ratingsByRecipe = Object.fromEntries(
      (ratings ?? []).map((r) => [r.recipe_id, r.rating as RatingValue])
    );
    queuedRecipeIds = new Set((queued ?? []).map((q) => q.recipe_id));
    pickedFlavorIds = (picks ?? []).map((p) => p.flavor_id as string);
  }

  const recipesWithRatings: RecipeWithRating[] = (recipes ?? []).map((r) => ({
    ...(r as Recipe),
    rating: ratingsByRecipe[r.id] ?? null,
    queued: queuedRecipeIds.has(r.id),
    editable: userData.user != null,
  }));

  return (
    <RecipesBrowser
      recipes={recipesWithRatings}
      tagColors={(tagColors ?? []) as TagColor[]}
      pickedFlavorIds={pickedFlavorIds}
    />
  );
}
