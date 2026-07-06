import { getMyPreferences } from "@/app/actions/profile";
import OnboardingForm from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const prefs = await getMyPreferences();
  if (!prefs) return null;

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h1 className="font-display text-xl font-light mb-1">Welcome to WeeklyNom</h1>
      <p className="text-sm text-ink-light mb-6">
        A few quick questions so AI-drafted recipes fit what you actually eat.
        You can skip this and finish it later from your account.
      </p>

      <OnboardingForm
        initialAllergies={prefs.allergies}
        initialAvoidFoods={prefs.avoidFoods}
        initialCuisinePreferences={prefs.cuisinePreferences}
      />
    </div>
  );
}
