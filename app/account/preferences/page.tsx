import { getMyPreferences, updateMyPreferences } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/server";
import AccountBackLink from "@/components/AccountBackLink";
import PreferencesForm from "@/components/PreferencesForm";
import type { TagColor } from "@/lib/types";

export default async function PreferencesSectionPage() {
  const supabase = await createClient();
  const [prefs, { data: cuisineColors }] = await Promise.all([
    getMyPreferences(),
    supabase.from("cuisine_colors").select("*"),
  ]);
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
        initialDietaryStyle={prefs.dietaryStyle}
        initialHealthGoals={prefs.healthGoals}
        cuisineColors={(cuisineColors ?? []) as TagColor[]}
        onSave={updateMyPreferences}
      />
    </div>
  );
}
