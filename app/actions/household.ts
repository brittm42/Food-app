"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold, isPrivileged, type HouseholdRole } from "@/lib/household";
import { sendInviteEmail } from "@/lib/email";

export type HouseholdMemberRow = {
  id: string;
  userId: string | null;
  role: HouseholdRole;
  joinedAt: string;
  email: string | null;
  displayName: string | null;
};

export async function listHouseholdMembers() {
  const household = await getCurrentHousehold();
  if (!household)
    return {
      members: [] as HouseholdMemberRow[],
      invites: [],
      role: null as HouseholdRole | null,
      householdName: undefined as string | undefined,
    };

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: memberRows }, { data: householdRow }] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, user_id, role, joined_at")
      .eq("household_id", household.householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("households")
      .select("name")
      .eq("id", household.householdId)
      .single(),
  ]);

  const rows = memberRows ?? [];
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => id != null);
  const memberIds = rows.filter((r) => r.user_id == null).map((r) => r.id);

  const [{ data: userProfileRows }, { data: dependentProfileRows }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
    memberIds.length
      ? admin.from("profiles").select("member_id, display_name").in("member_id", memberIds)
      : Promise.resolve({ data: [] as { member_id: string; display_name: string | null }[] }),
  ]);

  const displayNamesByUserId = new Map(
    (userProfileRows ?? []).map((p) => [p.user_id as string, p.display_name as string | null])
  );
  const displayNamesByMemberId = new Map(
    (dependentProfileRows ?? []).map((p) => [p.member_id as string, p.display_name as string | null])
  );

  const members: HouseholdMemberRow[] = await Promise.all(
    rows.map(async (row) => {
      if (row.user_id == null) {
        return {
          id: row.id as string,
          userId: null,
          role: row.role as HouseholdRole,
          joinedAt: row.joined_at as string,
          email: null,
          displayName: displayNamesByMemberId.get(row.id as string) ?? null,
        };
      }
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return {
        id: row.id as string,
        userId: row.user_id as string,
        role: row.role as HouseholdRole,
        joinedAt: row.joined_at as string,
        email: data.user?.email ?? "(unknown)",
        displayName: displayNamesByUserId.get(row.user_id as string) ?? null,
      };
    })
  );

  let invites: {
    id: string;
    invitedEmail: string;
    status: string;
    expiresAt: string;
  }[] = [];

  if (isPrivileged(household.role)) {
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
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can invite someone." };
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

  revalidatePath("/account/household");
  return {};
}

export async function updateHouseholdName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Household name can't be blank." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can rename it." };
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

  revalidatePath("/account/household");
  return {};
}

export async function removeMember(memberUserId: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can remove members." };
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
    .neq("role", "owner")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not remove that member. Try again." };

  revalidatePath("/account/household");
  return {};
}

export async function updateMemberRole(memberId: string, role: "member" | "manager") {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can change roles." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .update({ role })
    .eq("id", memberId)
    .eq("household_id", household.householdId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not update that member's role. Try again." };

  revalidatePath("/account/household");
  return {};
}

export async function createDependentProfile(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return { error: "Enter a name." };

  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can add a dependent profile." };
  }

  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("household_members")
    .insert({ household_id: household.householdId, user_id: null, role: "dependent" })
    .select("id")
    .single();

  if (memberError || !member) {
    return { error: memberError?.message ?? "Could not add that profile. Try again." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ member_id: member.id, display_name: trimmed });

  if (profileError) {
    await supabase.from("household_members").delete().eq("id", member.id);
    return { error: profileError.message };
  }

  revalidatePath("/account/household");
  return { memberId: member.id as string };
}

export async function removeDependent(memberId: string) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can remove a dependent profile." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .delete()
    .eq("id", memberId)
    .eq("household_id", household.householdId)
    .eq("role", "dependent")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not remove that profile. Try again." };

  revalidatePath("/account/household");
  return {};
}

export async function revokeInvite(inviteId: string) {
  const household = await getCurrentHousehold();
  if (!household || !isPrivileged(household.role)) return;

  const admin = createAdminClient();
  await admin
    .from("household_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("household_id", household.householdId);

  revalidatePath("/account/household");
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
