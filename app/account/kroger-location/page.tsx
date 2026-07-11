import { getCurrentHousehold } from "@/lib/household";
import AccountBackLink from "@/components/AccountBackLink";
import ChooseKrogerLocation from "@/components/ChooseKrogerLocation";

export default async function KrogerLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const params = await searchParams;
  const returnTo = params.returnTo && params.returnTo.startsWith("/") && !params.returnTo.startsWith("//")
    ? params.returnTo
    : "/account/household";

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink href="/account/household" label="Household" />
      <ChooseKrogerLocation returnTo={returnTo} />
    </div>
  );
}
