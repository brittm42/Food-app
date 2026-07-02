"use client";

import { useState, useTransition } from "react";
import { createInvite, revokeInvite } from "@/app/actions/household";

type Member = {
  userId: string;
  role: "owner" | "member";
  email: string;
};

type Invite = {
  id: string;
  invitedEmail: string;
  expiresAt: string;
};

export default function HouseholdPanel({
  householdName,
  members,
  invites,
  isOwner,
}: {
  householdName: string;
  members: Member[];
  invites: Invite[];
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setSent(null);
    startTransition(async () => {
      const result = await createInvite(trimmed);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(trimmed);
        setEmail("");
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(() => {
      revokeInvite(id);
    });
  }

  return (
    <section className="mt-8">
      <h1 className="font-display text-xl font-light mb-1">{householdName}</h1>
      <p className="text-sm text-ink-light mb-4">
        This Week, the pantry, and the shopping list are shared with everyone
        here. Recipes and ratings stay personal to each person.
      </p>

      <div className="flex flex-col gap-1.5 mb-6">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm"
          >
            <span>{m.email}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
              {m.role}
            </span>
          </div>
        ))}
      </div>

      {isOwner && (
        <>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
            Invite someone
          </h2>
          <form onSubmit={handleInvite} className="flex gap-2 mb-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their@email.com"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              Invite
            </button>
          </form>
          {sent && (
            <p className="text-sm text-teal mb-4">Invite sent to {sent}.</p>
          )}
          {error && <p className="text-sm text-red mb-4">{error}</p>}

          {invites.length > 0 && (
            <>
              <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2 mt-4">
                Pending invites
              </h2>
              <div className="flex flex-col gap-1.5">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <span>{inv.invitedEmail}</span>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={isPending}
                      className="text-ink-light hover:text-red text-xs cursor-pointer"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
