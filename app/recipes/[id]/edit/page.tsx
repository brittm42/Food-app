import { createClient } from "@/lib/supabase/server";
import { getRecipeById } from "@/app/actions/recipes";
import RecipeForm from "@/components/RecipeForm";
import type { TagColor } from "@/lib/types";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [recipe, { data: tagColors }] = await Promise.all([
    getRecipeById(id),
    supabase.from("tag_colors").select("*"),
  ]);

  if (!recipe) {
    return (
      <div className="text-center py-16 px-5">
        <div className="font-display text-xl font-light mb-2">Can&apos;t edit this recipe</div>
        <p className="text-sm text-ink-light max-w-xs mx-auto leading-relaxed">
          That recipe doesn&apos;t exist.
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
