import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveInvite } from "@/app/actions/household";
import AcceptInviteButton from "@/components/AcceptInviteButton";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-12 px-4 text-sm text-ink-light">
        Missing invite link.
      </div>
    );
  }

  const invite = await resolveInvite(token);

  if (!invite.valid) {
    return (
      <div className="max-w-sm mx-auto py-12 px-4">
        <h1 className="font-display text-xl font-light mb-2">
          Invite no longer valid
        </h1>
        <p className="text-sm text-ink-light leading-relaxed">
          This invite link has expired or was already used. Ask whoever
          invited you to send a new one.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    const next = encodeURIComponent(`/invite/accept?token=${token}`);
    return (
      <div className="max-w-sm mx-auto py-12 px-4">
        <h1 className="font-display text-xl font-light mb-2">
          You&apos;re invited to {invite.householdName}
        </h1>
        <p className="text-sm text-ink-light leading-relaxed mb-6">
          Sign in with {invite.invitedEmail} to join.
        </p>
        <Link
          href={`/login?next=${next}`}
          className="inline-block bg-ink text-white rounded-lg py-2 px-4 text-sm font-medium"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (userData.user.email?.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    return (
      <div className="max-w-sm mx-auto py-12 px-4">
        <h1 className="font-display text-xl font-light mb-2">
          Wrong account
        </h1>
        <p className="text-sm text-ink-light leading-relaxed">
          This invite was sent to <strong>{invite.invitedEmail}</strong>, but
          you&apos;re signed in as {userData.user.email}. Sign out and sign
          back in with the invited email to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-12 px-4">
      <h1 className="font-display text-xl font-light mb-2">
        Join {invite.householdName}
      </h1>
      <p className="text-sm text-ink-light leading-relaxed mb-6">
        You&apos;ll share This Week, the pantry, and the shopping list with
        the rest of the household. Your own recipes and ratings stay
        personal to you.
      </p>
      <AcceptInviteButton token={token} />
    </div>
  );
}
