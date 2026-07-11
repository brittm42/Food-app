import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getKrogerConnectionStatus } from "@/app/actions/kroger";
import { buildReviewItems } from "@/lib/kroger/review";
import KrogerReviewView from "@/components/KrogerReviewView";
import AccountBackLink from "@/components/AccountBackLink";

export default async function SendToKrogerPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const connection = await getKrogerConnectionStatus();
  if (!connection.connected) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <AccountBackLink href="/shopping" label="Shopping List" />
        <p className="text-sm text-ink-light">
          Connect your household&apos;s Kroger account first.
        </p>
        <Link
          href="/api/kroger/connect?returnTo=/shopping/send-to-kroger"
          className="inline-block mt-3 bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Connect Kroger
        </Link>
      </div>
    );
  }

  if (!connection.hasLocation) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <AccountBackLink href="/shopping" label="Shopping List" />
        <p className="text-sm text-ink-light">
          Pick which store you shop at first — this gets you real prices and
          availability instead of generic listings.
        </p>
        <Link
          href="/account/kroger-location?returnTo=/shopping/send-to-kroger"
          className="inline-block mt-3 bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Choose your store
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const result = await buildReviewItems(supabase, household.householdId, connection.locationId);

  if ("error" in result) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        Couldn&apos;t load the shopping list: {result.error}
      </div>
    );
  }

  if (result.items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <AccountBackLink href="/shopping" label="Shopping List" />
        <p className="text-sm text-ink-light">
          Nothing on your Shopping List to send right now.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink href="/shopping" label="Shopping List" />
      <KrogerReviewView items={result.items} bannerName={connection.bannerName} />
    </div>
  );
}
