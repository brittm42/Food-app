import { createClient } from "@/lib/supabase/server";
import { listHouseholdMembers } from "@/app/actions/household";
import AccountBackLink from "@/components/AccountBackLink";
import HouseholdPanel from "@/components/HouseholdPanel";

export default async function HouseholdSectionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { members, invites, role, householdName } = await listHouseholdMembers();

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <HouseholdPanel
        householdName={householdName ?? "Home"}
        members={members}
        invites={invites}
        isOwner={role === "owner"}
        currentUserId={userData.user.id}
      />
    </div>
  );
}
