import { createClient } from "@/lib/supabase/server";
import ThisWeekView from "@/components/ThisWeekView";
import type { Recipe } from "@/lib/types";

export default async function ThisWeekPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: queue, error } = await supabase
    .from("week_queue")
    .select("id, recipe:recipes(*)")
    .eq("user_id", userData.user.id)
    .order("added_at");

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load This Week: {error.message}
      </div>
    );
  }

  const items = (queue ?? []).map((q) => ({
    queueId: q.id as string,
    recipe: q.recipe as unknown as Recipe,
  }));

  return <ThisWeekView items={items} />;
}
