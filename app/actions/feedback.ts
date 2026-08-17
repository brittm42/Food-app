"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold } from "@/lib/household";
import { getAuthClaims } from "@/lib/auth";
import { sendFeedbackNotificationEmail } from "@/lib/email";

export type FeedbackCategory = "bug" | "idea" | "other";

export async function submitFeedback(category: FeedbackCategory, message: string) {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Enter some feedback first." };

  const claims = await getAuthClaims();
  if (!claims) return { error: "Not signed in." };

  const household = await getCurrentHousehold();

  const admin = createAdminClient();
  const { error } = await admin.from("feedback").insert({
    user_id: claims.id,
    household_id: household?.householdId ?? null,
    category,
    message: trimmed,
  });
  if (error) return { error: error.message };

  // Best-effort notification -- the feedback is already saved either way,
  // so a Resend hiccup shouldn't make this look like it failed to submit.
  try {
    await sendFeedbackNotificationEmail(category, trimmed, claims.email);
  } catch {
    // swallow -- see comment above
  }

  return {};
}
