"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";
import type { Allergy } from "@/lib/types";

export type Preferences = {
  allergies: Allergy[];
  avoidFoods: string[];
  cuisinePreferences: string[];
  dietaryStyle: string[];
  healthGoals: string[];
};

export type OnboardingStatus = "pending" | "completed";

export async function getDisplayName(): Promise<string | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return data?.display_name ?? null;
}

export async function updateDisplayName(name: string) {
  const trimmed = name.trim();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userData.user.id, display_name: trimmed || null },
      { onConflict: "user_id" }
    )
    .select("user_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not save your name. Try again." };

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return {};
}

export async function getMyPreferences(): Promise<
  (Preferences & { onboardingStatus: OnboardingStatus }) | null
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("allergies, avoid_foods, cuisine_preferences, dietary_style, health_goals, onboarding_status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return {
    allergies: (data?.allergies as Allergy[] | null) ?? [],
    avoidFoods: data?.avoid_foods ?? [],
    cuisinePreferences: data?.cuisine_preferences ?? [],
    dietaryStyle: data?.dietary_style ?? [],
    healthGoals: data?.health_goals ?? [],
    onboardingStatus: (data?.onboarding_status as OnboardingStatus) ?? "pending",
  };
}

// markComplete defaults to true for every existing caller (e.g.
// /account/preferences editing after onboarding is already done). The
// wizard's own preferences step is the one caller that passes false — it's
// just one of several required steps, not the whole of onboarding, so
// onboarding_status shouldn't flip to "completed" until finishOnboarding()
// (app/actions/onboarding.ts) runs at the very end.
export async function updateMyPreferences(prefs: Preferences, markComplete = true) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const update: Record<string, unknown> = {
    user_id: userData.user.id,
    allergies: prefs.allergies,
    avoid_foods: prefs.avoidFoods,
    cuisine_preferences: prefs.cuisinePreferences,
    dietary_style: prefs.dietaryStyle,
    health_goals: prefs.healthGoals,
  };
  if (markComplete) update.onboarding_status = "completed";

  const { data, error } = await supabase
    .from("profiles")
    .upsert(update, { onConflict: "user_id" })
    .select("user_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not save your preferences. Try again." };

  revalidatePath("/account");
  revalidatePath("/account/preferences");
  revalidatePath("/onboarding");
  return {};
}

export async function getDependentProfile(memberId: string): Promise<
  (Preferences & { displayName: string | null }) | null
> {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, allergies, avoid_foods, cuisine_preferences, dietary_style, health_goals")
    .eq("member_id", memberId)
    .maybeSingle();

  if (!data) return null;

  return {
    displayName: data.display_name,
    allergies: (data.allergies as Allergy[] | null) ?? [],
    avoidFoods: data.avoid_foods ?? [],
    cuisinePreferences: data.cuisine_preferences ?? [],
    dietaryStyle: data.dietary_style ?? [],
    healthGoals: data.health_goals ?? [],
  };
}

export async function updateDependentProfile(
  memberId: string,
  input: Preferences & { displayName: string }
) {
  const household = await getCurrentHousehold();
  if (!household) return { error: "Not signed in." };
  if (!isPrivileged(household.role)) {
    return { error: "Only the household owner or a manager can edit a dependent's profile." };
  }

  const trimmedName = input.displayName.trim();
  if (!trimmedName) return { error: "Enter a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: trimmedName,
      allergies: input.allergies,
      avoid_foods: input.avoidFoods,
      cuisine_preferences: input.cuisinePreferences,
      dietary_style: input.dietaryStyle,
      health_goals: input.healthGoals,
    })
    .eq("member_id", memberId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not save that profile. Try again." };

  revalidatePath("/account/household");
  revalidatePath(`/account/dependents/${memberId}`);
  return {};
}
