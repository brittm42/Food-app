"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";

export type KrogerConnectionStatus =
  | { connected: false }
  | { connected: true; connectedByName: string | null; connectedAt: string };

// kroger_connections has no RLS policies at all (see
// supabase/kroger-connections.sql), so every read/write goes through the
// admin client even though the caller here does have a normal session — the
// household scoping is enforced in application code instead of by RLS.
export async function getKrogerConnectionStatus(): Promise<KrogerConnectionStatus> {
  const household = await getCurrentHousehold();
  if (!household) return { connected: false };

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("kroger_connections")
    .select("connected_by, created_at")
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (!connection) return { connected: false };

  let connectedByName: string | null = null;
  if (connection.connected_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", connection.connected_by)
      .maybeSingle();
    if (profile?.display_name) {
      connectedByName = profile.display_name;
    } else {
      const { data } = await admin.auth.admin.getUserById(connection.connected_by);
      connectedByName = data.user?.email ?? null;
    }
  }

  return { connected: true, connectedByName, connectedAt: connection.created_at };
}

export async function disconnectKroger() {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can disconnect Kroger." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("kroger_connections")
    .delete()
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidatePath("/account/household");
  return {};
}
