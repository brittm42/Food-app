import { createClient } from "@/lib/supabase/server";
import { getDisplayName, getMyPreferences } from "@/app/actions/profile";
import { listHouseholdMembers } from "@/app/actions/household";
import AccountSectionRow from "@/components/AccountSectionRow";
import AvatarInitials from "@/components/AvatarInitials";

function preferencesSubtitle(prefs: Awaited<ReturnType<typeof getMyPreferences>>) {
  if (!prefs) return undefined;
  const count =
    prefs.allergies.length +
    prefs.avoidFoods.length +
    prefs.cuisinePreferences.length +
    prefs.dietaryStyle.length +
    prefs.healthGoals.length;
  return count > 0 ? `${count} preference${count === 1 ? "" : "s"} saved` : "Add your food preferences";
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [displayName, { householdName }, prefs] = await Promise.all([
    getDisplayName(),
    listHouseholdMembers(),
    getMyPreferences(),
  ]);

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <AvatarInitials name={displayName} email={userData.user.email} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-light truncate">
            {displayName || userData.user.email}
          </h1>
          {displayName && (
            <p className="text-xs text-ink-light truncate">{userData.user.email}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AccountSectionRow
          href="/account/profile"
          title="Profile"
          subtitle={displayName ? `Display name: ${displayName}` : "Add a display name"}
        />
        <AccountSectionRow
          href="/account/household"
          title="Household"
          subtitle={householdName ?? "Not in a household yet"}
        />
        <AccountSectionRow
          href="/account/preferences"
          title="Preferences"
          subtitle={preferencesSubtitle(prefs)}
        />
      </div>
    </div>
  );
}
