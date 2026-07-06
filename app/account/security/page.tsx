import { createClient } from "@/lib/supabase/server";
import AccountBackLink from "@/components/AccountBackLink";
import SetPasswordForm from "@/components/SetPasswordForm";

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email",
  google: "Google",
};

function joinWithAnd(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default async function SecuritySectionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const providers = userData.user.app_metadata?.providers as string[] | undefined;
  const signInMethods = (providers ?? [userData.user.app_metadata?.provider])
    .filter((p): p is string => Boolean(p))
    .map((p) => PROVIDER_LABELS[p] ?? p);

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-1">Security</h1>
      <p className="text-sm text-ink-light">{userData.user.email}</p>
      {signInMethods.length > 0 && (
        <p className="text-xs text-ink-light mt-1">
          Signed in via {joinWithAnd(signInMethods)}
        </p>
      )}

      <SetPasswordForm />
    </div>
  );
}
