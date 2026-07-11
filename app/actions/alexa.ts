"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";

export type AlexaLinkedAccount = {
  id: string;
  linkedEmail: string;
  connectedByName: string | null;
  connectedAt: string;
};

// alexa_linked_accounts has no RLS policies (see
// supabase/alexa-linked-accounts.sql), so every read/write goes through the
// admin client even though the caller here does have a normal session — the
// household scoping is enforced in application code instead of by RLS.
//
// A household can link more than one Amazon account (separate Echo devices
// on different logins are common) — they're all just adding to the same
// shared list, so this returns a list rather than a single connection.
export async function listAlexaLinkedAccounts(): Promise<AlexaLinkedAccount[]> {
  const household = await getCurrentHousehold();
  if (!household) return [];

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("alexa_linked_accounts")
    .select("id, linked_email, connected_by, created_at")
    .eq("household_id", household.householdId)
    .order("created_at", { ascending: true });

  if (!links || links.length === 0) return [];

  const connectorIds = [...new Set(links.map((l) => l.connected_by).filter((id): id is string => !!id))];
  const names = new Map<string, string | null>();
  for (const userId of connectorIds) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (profile?.display_name) {
      names.set(userId, profile.display_name);
    } else {
      const { data } = await admin.auth.admin.getUserById(userId);
      names.set(userId, data.user?.email ?? null);
    }
  }

  return links.map((link) => ({
    id: link.id,
    linkedEmail: link.linked_email,
    connectedByName: link.connected_by ? (names.get(link.connected_by) ?? null) : null,
    connectedAt: link.created_at,
  }));
}

export async function addAlexaLinkedEmail(email: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can add this." };
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: "Enter a valid email address." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("alexa_linked_accounts").insert({
    household_id: household.householdId,
    linked_email: trimmed,
    connected_by: household.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That email is already linked to a household." };
    }
    return { error: error.message };
  }

  revalidatePath("/account/household");
  return {};
}

export async function removeAlexaLinkedEmail(id: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can remove this." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("alexa_linked_accounts")
    .delete()
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidatePath("/account/household");
  return {};
}
