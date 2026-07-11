"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";

export type AlexaLinkStatus =
  | { linked: false }
  | { linked: true; linkedEmail: string; connectedByName: string | null; connectedAt: string };

// alexa_linked_accounts has no RLS policies (see
// supabase/alexa-linked-accounts.sql), so every read/write goes through the
// admin client even though the caller here does have a normal session — the
// household scoping is enforced in application code instead of by RLS.
export async function getAlexaLinkStatus(): Promise<AlexaLinkStatus> {
  const household = await getCurrentHousehold();
  if (!household) return { linked: false };

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("alexa_linked_accounts")
    .select("linked_email, connected_by, created_at")
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (!link) return { linked: false };

  let connectedByName: string | null = null;
  if (link.connected_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", link.connected_by)
      .maybeSingle();
    if (profile?.display_name) {
      connectedByName = profile.display_name;
    } else {
      const { data } = await admin.auth.admin.getUserById(link.connected_by);
      connectedByName = data.user?.email ?? null;
    }
  }

  return {
    linked: true,
    linkedEmail: link.linked_email,
    connectedByName,
    connectedAt: link.created_at,
  };
}

export async function setAlexaLinkedEmail(email: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can set this." };
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: "Enter a valid email address." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("alexa_linked_accounts").upsert(
    {
      household_id: household.householdId,
      linked_email: trimmed,
      connected_by: household.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/account/household");
  return {};
}

export async function removeAlexaLinkedEmail() {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can remove this." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("alexa_linked_accounts")
    .delete()
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidatePath("/account/household");
  return {};
}
