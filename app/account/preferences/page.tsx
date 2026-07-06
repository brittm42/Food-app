import { getMyPreferences, updateMyPreferences } from "@/app/actions/profile";
import AccountBackLink from "@/components/AccountBackLink";
import PreferencesForm from "@/components/PreferencesForm";

export default async function PreferencesSectionPage() {
  const prefs = await getMyPreferences();
  if (!prefs) return null;

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-1">Preferences</h1>
      <p className="text-sm text-ink-light mb-6">
        Helps AI-drafted recipes fit what you actually eat.
      </p>

      <PreferencesForm
        initialAllergies={prefs.allergies}
        initialAvoidFoods={prefs.avoidFoods}
        initialCuisinePreferences={prefs.cuisinePreferences}
        onSave={updateMyPreferences}
      />
    </div>
  );
}
