"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold } from "@/lib/household";
import { sendInviteEmail } from "@/lib/email";

export async function listHouseholdMembers() {
  const household = await getCurrentHousehold();
  if (!household)
    return {
      members: [],
      invites: [],
      role: null as "owner" | "member" | null,
      householdName: undefined as string | undefined,
    };

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: memberRows }, { data: householdRow }] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, role, joined_at")
      .eq("household_id", household.householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("households")
      .select("name")
      .eq("id", household.householdId)
      .single(),
  ]);

  const members = await Promise.all(
    (memberRows ?? []).map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return {
        userId: row.user_id,
        role: row.role as "owner" | "member",
        joinedAt: row.joined_at as string,
        email: data.user?.email ?? "(unknown)",
      };
    })
  );

  let invites: {
    id: string;
    invitedEmail: string;
    status: string;
    expiresAt: string;
  }[] = [];

  if (household.role === "owner") {
    const { data: inviteRows } = await admin
      .from("household_invites")
      .select("id, invited_email, status, expires_at")
      .eq("household_id", household.householdId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    invites = (inviteRows ?? []).map((r) => ({
      id: r.id,
      invitedEmail: r.invited_email,
      status: r.status,
      expiresAt: r.expires_at,
    }));
  }

  return {
    members,
    invites,
    role: household.role,
    householdName: householdRow?.name ?? "Home",
  };
}

export async function createInvite(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (household.role !== "owner") {
    return { error: "Only the household owner can invite someone." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("household_invites")
    .select("id, token")
    .eq("household_id", household.householdId)
    .eq("invited_email", trimmed)
    .eq("status", "pending")
    .maybeSingle();

  let token: string;
  if (existing) {
    const { data: renewed, error } = await admin
      .from("household_invites")
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", existing.id)
      .select("token")
      .single();
    if (error || !renewed) return { error: error?.message ?? "Could not renew invite." };
    token = renewed.token;
  } else {
    const { data: created, error } = await admin
      .from("household_invites")
      .insert({
        household_id: household.householdId,
        invited_email: trimmed,
        invited_by: household.userId,
      })
      .select("token")
      .single();
    if (error || !created) return { error: error?.message ?? "Could not create invite." };
    token = created.token;
  }

  const origin = (await headers()).get("origin");
  const inviteUrl = `${origin}/invite/accept?token=${token}`;

  const { data: householdRow } = await admin
    .from("households")
    .select("name")
    .eq("id", household.householdId)
    .single();

  const { error: emailError } = await sendInviteEmail(
    trimmed,
    householdRow?.name ?? "our household",
    inviteUrl
  );

  if (emailError) {
    return { error: `Invite created, but the email failed to send: ${emailError.message}` };
  }

  revalidatePath("/profile");
  return {};
}

export async function updateHouseholdName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Household name can't be blank." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (household.role !== "owner") {
    return { error: "Only the household owner can rename it." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .update({ name: trimmed })
    .eq("id", household.householdId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not rename the household. Try again." };

  revalidatePath("/profile");
  return {};
}

export async function removeMember(memberUserId: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (household.role !== "owner") {
    return { error: "Only the household owner can remove members." };
  }
  if (memberUserId === household.userId) {
    return { error: "You can't remove yourself." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", household.householdId)
    .eq("user_id", memberUserId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not remove that member. Try again." };

  revalidatePath("/profile");
  return {};
}

export async function revokeInvite(inviteId: string) {
  const household = await getCurrentHousehold();
  if (!household || household.role !== "owner") return;

  const admin = createAdminClient();
  await admin
    .from("household_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("household_id", household.householdId);

  revalidatePath("/profile");
}

export async function resolveInvite(token: string) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("household_invites")
    .select("id, invited_email, status, expires_at, household_id, households(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return { valid: false as const };
  }

  const householdName =
    (invite.households as unknown as { name: string } | null)?.name ?? "a household";

  return {
    valid: true as const,
    invitedEmail: invite.invited_email as string,
    householdName,
  };
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("household_invites")
    .select("id, invited_email, status, expires_at, household_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return { error: "This invite is no longer valid." };
  }

  if (invite.invited_email.toLowerCase() !== userData.user.email?.toLowerCase()) {
    return { error: "This invite was sent to a different email address." };
  }

  const { data: existingMembership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (existingMembership) {
    return { error: "You're already in a household." };
  }

  const { error: insertError } = await admin.from("household_members").insert({
    household_id: invite.household_id,
    user_id: userData.user.id,
    role: "member",
  });
  if (insertError) return { error: insertError.message };

  await admin
    .from("household_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userData.user.id,
    })
    .eq("id", invite.id);

  revalidatePath("/");
  return {};
}
