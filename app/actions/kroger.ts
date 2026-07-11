"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";
import { searchLocations, type KrogerLocation } from "@/lib/kroger/locations";
import { displayNameForChain } from "@/lib/kroger/chains";

export type KrogerConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      connectedByName: string | null;
      connectedAt: string;
      hasLocation: boolean;
      locationId: string | null;
      locationName: string | null;
      bannerName: string;
    };

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
    .select("connected_by, created_at, location_id, location_name, location_chain")
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

  return {
    connected: true,
    connectedByName,
    connectedAt: connection.created_at,
    hasLocation: !!connection.location_name,
    locationId: connection.location_id,
    locationName: connection.location_name,
    bannerName: displayNameForChain(connection.location_chain),
  };
}

// Wraps the Locations API for the "choose your store" step — a plain
// zip-code search, no household scoping needed since Locations is an
// app-level API (same as Products search).
export async function findKrogerLocations(zipCode: string): Promise<
  { locations: KrogerLocation[] } | { error: string }
> {
  const trimmed = zipCode.trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { error: "Enter a 5-digit zip code." };
  }
  try {
    const locations = await searchLocations(trimmed);
    return { locations };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Location search failed." };
  }
}

export async function selectKrogerLocation(
  locationId: string,
  locationName: string,
  chain: string
) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can set the store." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("kroger_connections")
    .update({ location_id: locationId, location_name: locationName, location_chain: chain })
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidatePath("/account/household");
  return {};
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
