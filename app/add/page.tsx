import { createClient } from "@/lib/supabase/server";
import RecipeForm from "@/components/RecipeForm";
import type { TagColor } from "@/lib/types";

export default async function AddRecipePage() {
  const supabase = await createClient();
  const { data: tagColors } = await supabase.from("tag_colors").select("*");

  return <RecipeForm mode="create" tagColors={(tagColors ?? []) as TagColor[]} />;
}
