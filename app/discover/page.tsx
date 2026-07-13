import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import DiscoverBrowser from "@/components/DiscoverBrowser";
import LandingPage from "@/components/LandingPage";
import type { Recipe, TagColor } from "@/lib/types";

export default async function DiscoverPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return <LandingPage />;
  }

  const household = await getCurrentHousehold();
  if (!household) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        You need a household before you can browse other kitchens&apos; recipes.
      </div>
    );
  }

  const [{ data: recipes, error }, { data: tagColors }, { data: imported }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("*")
        .eq("is_public", true)
        .neq("household_id", household.householdId)
        .order("name"),
      supabase.from("tag_colors").select("*"),
      supabase
        .from("recipes")
        .select("imported_from_recipe_id")
        .eq("household_id", household.householdId)
        .not("imported_from_recipe_id", "is", null),
    ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load Discover: {error.message}
      </div>
    );
  }

  const alreadyImportedIds = (imported ?? []).map(
    (r) => r.imported_from_recipe_id as string
  );

  return (
    <DiscoverBrowser
      recipes={(recipes ?? []) as Recipe[]}
      tagColors={(tagColors ?? []) as TagColor[]}
      alreadyImportedIds={alreadyImportedIds}
    />
  );
}
