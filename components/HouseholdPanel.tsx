"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createInvite,
  revokeInvite,
  updateHouseholdName,
  removeMember,
  removeDependent,
  updateMemberRole,
  createDependentProfile,
} from "@/app/actions/household";

type Role = "owner" | "manager" | "member" | "dependent";

type Member = {
  id: string;
  userId: string | null;
  role: Role;
  email: string | null;
  displayName: string | null;
};

type Invite = {
  id: string;
  invitedEmail: string;
  expiresAt: string;
};

const ROLE_LABELS: Record<Role, string> = {
  owner: "owner",
  manager: "manager",
  member: "member",
  dependent: "dependent",
};

export default function HouseholdPanel({
  householdName,
  members,
  invites,
  isPrivileged,
  currentUserId,
}: {
  householdName: string;
  members: Member[];
  invites: Invite[];
  isPrivileged: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(householdName);
  const [nameError, setNameError] = useState<string | null>(null);

  const [dependentName, setDependentName] = useState("");
  const [dependentError, setDependentError] = useState<string | null>(null);

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

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setNameError(null);
    startTransition(async () => {
      const result = await updateHouseholdName(trimmed);
      if (result?.error) {
        setNameError(result.error);
      } else {
        setEditingName(false);
      }
    });
  }

  const [removeError, setRemoveError] = useState<string | null>(null);

  function handleRemove(member: Member) {
    setRemoveError(null);
    startTransition(async () => {
      const result =
        member.role === "dependent"
          ? await removeDependent(member.id)
          : await removeMember(member.userId!);
      if (result?.error) setRemoveError(result.error);
    });
  }

  function handleRoleChange(member: Member, role: "member" | "manager") {
    setRemoveError(null);
    startTransition(async () => {
      const result = await updateMemberRole(member.id, role);
      if (result?.error) setRemoveError(result.error);
    });
  }

  function handleAddDependent(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = dependentName.trim();
    if (!trimmed) return;
    setDependentError(null);
    startTransition(async () => {
      const result = await createDependentProfile(trimmed);
      if (result?.error) {
        setDependentError(result.error);
      } else {
        setDependentName("");
        if (result.memberId) router.push(`/account/dependents/${result.memberId}`);
      }
    });
  }

  return (
    <section>
      {isPrivileged && editingName ? (
        <form onSubmit={handleSaveName} className="flex gap-2 mb-1">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            autoFocus
            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-ink text-white rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingName(false);
              setNameDraft(householdName);
              setNameError(null);
            }}
            className="text-ink-light text-sm cursor-pointer px-2"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-xl font-light">{householdName}</h1>
          {isPrivileged && (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-ink-light hover:text-teal text-xs cursor-pointer"
            >
              Rename
            </button>
          )}
        </div>
      )}
      {nameError && <p className="text-sm text-red mb-1">{nameError}</p>}
      <p className="text-sm text-ink-light mb-4">
        This Week, the pantry, and the shopping list are shared with everyone
        here. Recipes and ratings stay personal to each person.
      </p>

      {removeError && <p className="text-sm text-red mb-2">{removeError}</p>}
      <div className="flex flex-col gap-1.5 mb-6">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm gap-2"
          >
            <span className="truncate">
              {m.displayName || m.email || "(unnamed)"}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
                {ROLE_LABELS[m.role]}
              </span>
              {m.role === "dependent" && (
                <Link
                  href={`/account/dependents/${m.id}`}
                  className="text-ink-light hover:text-teal text-xs"
                >
                  Preferences
                </Link>
              )}
              {isPrivileged && (m.role === "member" || m.role === "manager") && (
                <button
                  type="button"
                  onClick={() =>
                    handleRoleChange(m, m.role === "manager" ? "member" : "manager")
                  }
                  disabled={isPending}
                  className="text-ink-light hover:text-teal text-xs cursor-pointer"
                >
                  {m.role === "manager" ? "Make member" : "Make manager"}
                </button>
              )}
              {isPrivileged && m.role !== "owner" && m.userId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  disabled={isPending}
                  className="text-ink-light hover:text-red text-xs cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isPrivileged && (
        <>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
            Add a dependent profile
          </h2>
          <p className="text-sm text-ink-light mb-2">
            For someone without their own login — a kid, for example — so
            their allergies and preferences still count toward recipes.
          </p>
          <form onSubmit={handleAddDependent} className="flex gap-2 mb-6">
            <input
              type="text"
              value={dependentName}
              onChange={(e) => setDependentName(e.target.value)}
              placeholder="Their name"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {dependentError && <p className="text-sm text-red -mt-4 mb-6">{dependentError}</p>}

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
