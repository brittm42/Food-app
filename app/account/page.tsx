import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/app/actions/profile";
import { listHouseholdMembers } from "@/app/actions/household";
import AccountSectionRow from "@/components/AccountSectionRow";
import AvatarInitials from "@/components/AvatarInitials";

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email",
  google: "Google",
};

function joinWithAnd(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [displayName, { householdName }] = await Promise.all([
    getDisplayName(),
    listHouseholdMembers(),
  ]);

  const providers = userData.user.app_metadata?.providers as string[] | undefined;
  const signInMethods = (providers ?? [userData.user.app_metadata?.provider])
    .filter((p): p is string => Boolean(p))
    .map((p) => PROVIDER_LABELS[p] ?? p);

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
          href="/account/security"
          title="Security"
          subtitle={
            signInMethods.length > 0
              ? `Signed in via ${joinWithAnd(signInMethods)}`
              : undefined
          }
        />
        <AccountSectionRow
          href="/account/preferences"
          title="Preferences"
          subtitle="Coming soon"
        />
      </div>
    </div>
  );
}
