import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/app/actions/profile";
import AccountBackLink from "@/components/AccountBackLink";
import AvatarInitials from "@/components/AvatarInitials";
import ProfileNameForm from "@/components/ProfileNameForm";

export default async function ProfileSectionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const displayName = await getDisplayName();

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
    </div>
  );
}
