import { getMyPreferences } from "@/app/actions/profile";
import { getHouseholdCookingProfile } from "@/app/actions/household";
import { listHouseholdMembers } from "@/app/actions/household";
import { isPrivileged } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/OnboardingWizard";
import type { TagColor } from "@/lib/types";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const [prefs, cookingProfile, { householdName, members, role }, { data: cuisineColors }] =
    await Promise.all([
      getMyPreferences(),
      getHouseholdCookingProfile(),
      listHouseholdMembers(),
      supabase.from("cuisine_colors").select("*"),
    ]);
  if (!prefs) return null;

  const dependents = members
    .filter((m) => m.userId === null)
    .map((m) => ({ memberId: m.id, displayName: m.displayName ?? "" }));

  // A plain "member" (always the role acceptInvite assigns) is joining a
  // household someone else already set up -- household name/cooking
  // profile/dependents are that owner's/manager's to set, not theirs, and
  // those server actions reject a non-privileged caller outright. Give them
  // just the one step that's actually about them.
  const canManageHousehold = isPrivileged(role);

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <OnboardingWizard
        canManageHousehold={canManageHousehold}
        cuisineColors={(cuisineColors ?? []) as TagColor[]}
        initialHouseholdName={householdName ?? "Home"}
        initialPrefs={{
          allergies: prefs.allergies,
          avoidFoods: prefs.avoidFoods,
          cuisinePreferences: prefs.cuisinePreferences,
          dietaryStyle: prefs.dietaryStyle,
          healthGoals: prefs.healthGoals,
        }}
        initialCookingProfile={
          cookingProfile ?? {
            householdSize: null,
            mealPriorities: [],
            weeknightTimeMinutes: null,
            skillLevel: null,
          }
        }
        initialDependents={dependents}
      />
    </div>
  );
}
