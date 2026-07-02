import { createClient } from "@/lib/supabase/server";

export type CurrentHousehold = {
  userId: string;
  householdId: string;
  role: "owner" | "member";
};

export async function getCurrentHousehold(): Promise<CurrentHousehold | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (!membership) return null;

  return {
    userId: userData.user.id,
    householdId: membership.household_id,
    role: membership.role as "owner" | "member",
  };
}
