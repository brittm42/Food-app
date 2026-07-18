"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold } from "@/lib/household";
import { sendFeedbackNotificationEmail } from "@/lib/email";

export type FeedbackCategory = "bug" | "idea" | "other";

export async function submitFeedback(category: FeedbackCategory, message: string) {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Enter some feedback first." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const household = await getCurrentHousehold();

  const admin = createAdminClient();
  const { error } = await admin.from("feedback").insert({
    user_id: userData.user.id,
    household_id: household?.householdId ?? null,
    category,
    message: trimmed,
  });
  if (error) return { error: error.message };

  // Best-effort notification -- the feedback is already saved either way,
  // so a Resend hiccup shouldn't make this look like it failed to submit.
  try {
    await sendFeedbackNotificationEmail(category, trimmed, userData.user.email ?? null);
  } catch {
    // swallow -- see comment above
  }

  return {};
}
