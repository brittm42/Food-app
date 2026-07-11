import { createClient } from "@/lib/supabase/server";
import { listHouseholdMembers } from "@/app/actions/household";
import { getKrogerConnectionStatus } from "@/app/actions/kroger";
import { isPrivileged } from "@/lib/household";
import AccountBackLink from "@/components/AccountBackLink";
import HouseholdPanel from "@/components/HouseholdPanel";
import KrogerConnectionPanel from "@/components/KrogerConnectionPanel";

export default async function HouseholdSectionPage({
  searchParams,
}: {
  searchParams: Promise<{ kroger?: string; kroger_error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ members, invites, role, householdName }, krogerStatus, params] = await Promise.all([
    listHouseholdMembers(),
    getKrogerConnectionStatus(),
    searchParams,
  ]);

  const notice = params.kroger_error
    ? ({ kind: "error", message: params.kroger_error } as const)
    : params.kroger === "connected"
      ? ({
          kind: "connected",
          message: `${krogerStatus.connected ? krogerStatus.bannerName : "Kroger"} connected.`,
        } as const)
      : null;

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <HouseholdPanel
        householdName={householdName ?? "Home"}
        members={members}
        invites={invites}
        isPrivileged={isPrivileged(role)}
        currentUserId={userData.user.id}
      />
      <KrogerConnectionPanel
        connected={krogerStatus.connected}
        connectedByName={krogerStatus.connected ? krogerStatus.connectedByName : null}
        hasLocation={krogerStatus.connected ? krogerStatus.hasLocation : false}
        locationName={krogerStatus.connected ? krogerStatus.locationName : null}
        bannerName={krogerStatus.connected ? krogerStatus.bannerName : "Kroger"}
        isPrivileged={isPrivileged(role)}
        notice={notice}
      />
    </div>
  );
}
