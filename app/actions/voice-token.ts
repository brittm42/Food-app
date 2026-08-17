"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold } from "@/lib/household";

// Self-serve counterpart to scripts/create-voice-token.mjs: any signed-in
// user can generate/view their own voice_integration_tokens row for their
// current household, without needing someone with server access to run the
// script for them. See supabase/voice-integration-tokens-self-serve.sql —
// user_id is nullable so the older script-created rows (Britt's and
// Jason's iPhones) stay valid untouched.
export type VoiceToken = { label: string; token: string };

export async function getMyVoiceToken(): Promise<VoiceToken | null> {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_integration_tokens")
    .select("label, token")
    .eq("household_id", household.householdId)
    .eq("user_id", household.userId)
    .maybeSingle();

  return data ? { label: data.label as string, token: data.token as string } : null;
}

// Regenerate = replace: the partial unique index on (household_id,
// user_id) only allows one self-serve row per person per household, so an
// old token is invalidated the moment a new one is generated — matches
// "not re-prompted on every use" (one token, pasted once) without leaving
// stale valid tokens lying around.
export async function generateMyVoiceToken(): Promise<VoiceToken | { error: string }> {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("user_id", household.userId)
    .maybeSingle();
  const label = profile?.display_name ? `${profile.display_name}'s Shortcut` : "My Shortcut";
  const token = crypto.randomUUID();

  await admin
    .from("voice_integration_tokens")
    .delete()
    .eq("household_id", household.householdId)
    .eq("user_id", household.userId);

  const { error } = await admin
    .from("voice_integration_tokens")
    .insert({ household_id: household.householdId, user_id: household.userId, label, token });

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { label, token };
}
