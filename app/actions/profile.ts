"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold, isPrivileged } from "@/lib/household";

export type Preferences = {
  allergies: string[];
  avoidFoods: string[];
  cuisinePreferences: string[];
};

export type OnboardingStatus = "pending" | "skipped" | "completed";

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
    .select("allergies, avoid_foods, cuisine_preferences, onboarding_status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return {
    allergies: data?.allergies ?? [],
    avoidFoods: data?.avoid_foods ?? [],
    cuisinePreferences: data?.cuisine_preferences ?? [],
    onboardingStatus: (data?.onboarding_status as OnboardingStatus) ?? "pending",
  };
}

export async function updateMyPreferences(prefs: Preferences) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userData.user.id,
        allergies: prefs.allergies,
        avoid_foods: prefs.avoidFoods,
        cuisine_preferences: prefs.cuisinePreferences,
        onboarding_status: "completed",
      },
      { onConflict: "user_id" }
    )
    .select("user_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not save your preferences. Try again." };

  revalidatePath("/account");
  revalidatePath("/account/preferences");
  revalidatePath("/onboarding");
  return {};
}

export async function skipOnboarding() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userData.user.id, onboarding_status: "skipped" },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };
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
    .select("display_name, allergies, avoid_foods, cuisine_preferences")
    .eq("member_id", memberId)
    .maybeSingle();

  if (!data) return null;

  return {
    displayName: data.display_name,
    allergies: data.allergies ?? [],
    avoidFoods: data.avoid_foods ?? [],
    cuisinePreferences: data.cuisine_preferences ?? [],
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
