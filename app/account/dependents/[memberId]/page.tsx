import { getCurrentHousehold, isPrivileged } from "@/lib/household";
import { getDependentProfile, updateDependentProfile } from "@/app/actions/profile";
import { removeDependent } from "@/app/actions/household";
import AccountBackLink from "@/components/AccountBackLink";
import PreferencesForm from "@/components/PreferencesForm";
import RemoveDependentButton from "@/components/RemoveDependentButton";

export default async function DependentProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const household = await getCurrentHousehold();
  if (!household || !isPrivileged(household.role)) return null;

  const profile = await getDependentProfile(memberId);
  if (!profile) return null;

  async function saveDependentProfile(values: {
    displayName?: string;
    allergies: string[];
    avoidFoods: string[];
    cuisinePreferences: string[];
  }) {
    "use server";
    return updateDependentProfile(memberId, {
      displayName: values.displayName ?? "",
      allergies: values.allergies,
      avoidFoods: values.avoidFoods,
      cuisinePreferences: values.cuisinePreferences,
    });
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink href="/account/household" label="Household" />
      <h1 className="font-display text-xl font-light mb-1">
        {profile.displayName || "Dependent profile"}
      </h1>
      <p className="text-sm text-ink-light mb-6">
        Helps AI-drafted recipes fit what they actually eat.
      </p>

      <PreferencesForm
        initialDisplayName={profile.displayName ?? ""}
        initialAllergies={profile.allergies}
        initialAvoidFoods={profile.avoidFoods}
        initialCuisinePreferences={profile.cuisinePreferences}
        onSave={saveDependentProfile}
      />

      <RemoveDependentButton memberId={memberId} onRemove={removeDependent} />
    </div>
  );
}
