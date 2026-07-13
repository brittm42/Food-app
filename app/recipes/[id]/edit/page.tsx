import { createClient } from "@/lib/supabase/server";
import { getRecipeById } from "@/app/actions/recipes";
import { getCurrentHousehold } from "@/lib/household";
import RecipeForm from "@/components/RecipeForm";
import type { TagColor } from "@/lib/types";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [recipe, { data: tagColors }, household] = await Promise.all([
    getRecipeById(id),
    supabase.from("tag_colors").select("*"),
    getCurrentHousehold(),
  ]);

  // RLS is the real backstop against writing another household's recipe —
  // this just stops the form from rendering as if a save would succeed.
  if (!recipe || !household || recipe.household_id !== household.householdId) {
    return (
      <div className="text-center py-16 px-5">
        <div className="font-display text-xl font-light mb-2">Can&apos;t edit this recipe</div>
        <p className="text-sm text-ink-light max-w-xs mx-auto leading-relaxed">
          {recipe
            ? "This recipe belongs to another kitchen — import it first from Discover if you'd like your own editable copy."
            : "That recipe doesn't exist."}
        </p>
      </div>
    );
  }

  return (
    <RecipeForm
      mode="edit"
      recipeId={recipe.id}
      initial={recipe}
      tagColors={(tagColors ?? []) as TagColor[]}
    />
  );
}
