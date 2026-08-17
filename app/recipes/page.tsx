import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import RecipesBrowser from "@/components/RecipesBrowser";
import type { Recipe, RecipeWithRating, RatingValue, TagColor, Allergy } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const household = await getCurrentHousehold();

  const [{ data: recipes, error }, { data: tagColors }, { data: cuisineColors }] = await Promise.all([
    household
      ? supabase.from("recipes").select("*").eq("household_id", household.householdId).order("name")
      : Promise.resolve({ data: [] as Recipe[], error: null }),
    supabase.from("tag_colors").select("*"),
    supabase.from("cuisine_colors").select("*"),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load recipes: {error.message}
      </div>
    );
  }

  const [{ data: ratings }, { data: queued }, { data: picks }, { data: profiles }] = await Promise.all([
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
    // No explicit household filter — profiles_select's RLS already scopes
    // this to every profile in the caller's household (self + dependents).
    supabase.from("profiles").select("allergies"),
  ]);
  const ratingsByRecipe: Record<string, RatingValue> = Object.fromEntries(
    (ratings ?? []).map((r) => [r.recipe_id, r.rating as RatingValue])
  );
  const queuedRecipeIds = new Set((queued ?? []).map((q) => q.recipe_id));
  const pickedFlavorIds = (picks ?? []).map((p) => p.flavor_id as string);
  const householdAllergies = (profiles ?? []).flatMap((p) => (p.allergies as Allergy[] | null) ?? []);

  const recipesWithRatings: RecipeWithRating[] = (recipes ?? []).map((r) => ({
    ...(r as Recipe),
    rating: ratingsByRecipe[r.id] ?? null,
    queued: queuedRecipeIds.has(r.id),
    editable: true,
  }));

  return (
    <RecipesBrowser
      recipes={recipesWithRatings}
      tagColors={(tagColors ?? []) as TagColor[]}
      cuisineColors={(cuisineColors ?? []) as TagColor[]}
      pickedFlavorIds={pickedFlavorIds}
      householdAllergies={householdAllergies}
    />
  );
}
