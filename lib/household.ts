import { createClient } from "@/lib/supabase/server";
import { getAuthClaims } from "@/lib/auth";

export type HouseholdRole = "owner" | "manager" | "member" | "dependent";

export type CurrentHousehold = {
  userId: string;
  householdId: string;
  role: HouseholdRole;
};

export function isPrivileged(role: HouseholdRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export async function getCurrentHousehold(): Promise<CurrentHousehold | null> {
  const claims = await getAuthClaims();
  if (!claims) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", claims.id)
    .single();

  if (!membership) return null;

  return {
    userId: claims.id,
    householdId: membership.household_id,
    role: membership.role as HouseholdRole,
  };
}
