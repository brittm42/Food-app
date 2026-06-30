import { createClient } from "@/lib/supabase/server";
import PantryView from "@/components/PantryView";

export default async function PantryPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: checkedRows, error }, { data: staples }] = await Promise.all([
    supabase
      .from("pantry_state")
      .select("item_key")
      .eq("user_id", userData.user.id),
    supabase
      .from("pantry_staples")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the pantry: {error.message}
      </div>
    );
  }

  const checkedKeys = (checkedRows ?? []).map((r) => r.item_key);

  return <PantryView checkedKeys={checkedKeys} staples={staples ?? []} />;
}
