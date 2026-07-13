import { createClient } from "@/lib/supabase/server";
import { listHouseholdMembers, getHouseholdCookingProfile } from "@/app/actions/household";
import { getKrogerConnectionStatus } from "@/app/actions/kroger";
import { listAlexaLinkedAccounts } from "@/app/actions/alexa";
import { isPrivileged } from "@/lib/household";
import AccountBackLink from "@/components/AccountBackLink";
import HouseholdPanel from "@/components/HouseholdPanel";
import HouseholdCookingProfilePanel from "@/components/HouseholdCookingProfilePanel";
import KrogerConnectionPanel from "@/components/KrogerConnectionPanel";
import AlexaLinkedEmailPanel from "@/components/AlexaLinkedEmailPanel";

export default async function HouseholdSectionPage({
  searchParams,
}: {
  searchParams: Promise<{ kroger?: string; kroger_error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ members, invites, role, householdName }, cookingProfile, krogerStatus, alexaAccounts, params] =
    await Promise.all([
      listHouseholdMembers(),
      getHouseholdCookingProfile(),
      getKrogerConnectionStatus(),
      listAlexaLinkedAccounts(),
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
      <HouseholdCookingProfilePanel
        householdSize={cookingProfile?.householdSize ?? null}
        mealPriorities={cookingProfile?.mealPriorities ?? []}
        weeknightTimeMinutes={cookingProfile?.weeknightTimeMinutes ?? null}
        skillLevel={cookingProfile?.skillLevel ?? null}
        isPrivileged={isPrivileged(role)}
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
      <AlexaLinkedEmailPanel accounts={alexaAccounts} isPrivileged={isPrivileged(role)} />
    </div>
  );
}
