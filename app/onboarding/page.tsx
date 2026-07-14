import { getMyPreferences } from "@/app/actions/profile";
import { getHouseholdCookingProfile } from "@/app/actions/household";
import { listHouseholdMembers } from "@/app/actions/household";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const [prefs, cookingProfile, { householdName, members }] = await Promise.all([
    getMyPreferences(),
    getHouseholdCookingProfile(),
    listHouseholdMembers(),
  ]);
  if (!prefs) return null;

  const dependents = members
    .filter((m) => m.userId === null)
    .map((m) => ({ memberId: m.id, displayName: m.displayName ?? "" }));

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <OnboardingWizard
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
