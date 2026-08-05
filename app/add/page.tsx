import { createClient } from "@/lib/supabase/server";
import RecipeForm from "@/components/RecipeForm";
import type { TagColor } from "@/lib/types";

export default async function AddRecipePage() {
  const supabase = await createClient();
  const [{ data: tagColors }, { data: cuisineColors }] = await Promise.all([
    supabase.from("tag_colors").select("*"),
    supabase.from("cuisine_colors").select("*"),
  ]);

  return (
    <RecipeForm
      mode="create"
      tagColors={(tagColors ?? []) as TagColor[]}
      cuisineColors={(cuisineColors ?? []) as TagColor[]}
    />
  );
}
