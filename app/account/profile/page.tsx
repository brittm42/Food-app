import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/app/actions/profile";
import AccountBackLink from "@/components/AccountBackLink";
import AvatarInitials from "@/components/AvatarInitials";
import ProfileNameForm from "@/components/ProfileNameForm";
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

export default async function ProfileSectionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const displayName = await getDisplayName();

  const providers = userData.user.app_metadata?.providers as string[] | undefined;
  const signInMethods = (providers ?? [userData.user.app_metadata?.provider])
    .filter((p): p is string => Boolean(p))
    .map((p) => PROVIDER_LABELS[p] ?? p);

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-6">Profile</h1>

      <div className="flex items-center gap-3 mb-6">
        <AvatarInitials name={displayName} email={userData.user.email} size={56} />
        <p className="text-sm text-ink-light">{userData.user.email}</p>
      </div>

      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Display name
      </h2>
      <p className="text-sm text-ink-light mb-3">
        Shown to other household members instead of your email.
      </p>
      <ProfileNameForm initialName={displayName} />

      {signInMethods.length > 0 && (
        <p className="text-xs text-ink-light mt-6">
          Signed in via {joinWithAnd(signInMethods)}
        </p>
      )}
      <SetPasswordForm />
    </div>
  );
}
