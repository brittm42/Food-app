"use client";

import { useState, useTransition } from "react";
import { removeAlexaLinkedEmail, setAlexaLinkedEmail } from "@/app/actions/alexa";

export default function AlexaLinkedEmailPanel({
  linked,
  linkedEmail,
  connectedByName,
  isPrivileged,
}: {
  linked: boolean;
  linkedEmail: string | null;
  connectedByName: string | null;
  isPrivileged: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!linked);
  const [email, setEmail] = useState(linkedEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setAlexaLinkedEmail(email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAlexaLinkedEmail();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      setEditing(true);
    });
  }

  return (
    <section className="mt-8 pt-6 border-t border-border">
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Alexa voice add
      </h2>

      {error && <p className="text-sm mb-3 text-red">{error}</p>}

      {linked && !editing ? (
        <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm">
          <span>
            Linked to {linkedEmail}
            {connectedByName ? ` (set by ${connectedByName})` : ""}
          </span>
          {isPrivileged && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={isPending}
                className="text-ink-light hover:text-teal text-xs cursor-pointer disabled:opacity-50"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="text-ink-light hover:text-red text-xs cursor-pointer disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : isPrivileged ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-light">
            Enter the email on the Amazon account your Echo devices use. That&apos;s
            what Alexa hands back when someone says &quot;add milk&quot; — link it here
            so voice add works for the whole household, no separate WeeklyNom
            login required.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !email.trim()}
              className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Save
            </button>
            {linked && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEmail(linkedEmail ?? "");
                  setError(null);
                }}
                disabled={isPending}
                className="text-ink-light hover:text-ink text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-light">
          Not set up. Ask an owner or manager to link your household&apos;s Amazon
          email for Alexa voice add.
        </p>
      )}
    </section>
  );
}
