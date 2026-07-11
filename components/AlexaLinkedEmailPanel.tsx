"use client";

import { useState, useTransition } from "react";
import { addAlexaLinkedEmail, removeAlexaLinkedEmail, type AlexaLinkedAccount } from "@/app/actions/alexa";

export default function AlexaLinkedEmailPanel({
  accounts,
  isPrivileged,
}: {
  accounts: AlexaLinkedAccount[];
  isPrivileged: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addAlexaLinkedEmail(email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEmail("");
    });
  }

  function handleRemove(id: string) {
    setError(null);
    startTransition(() => {
      removeAlexaLinkedEmail(id);
    });
  }

  return (
    <section className="mt-8 pt-6 border-t border-border">
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Add to Shopping List with Alexa
      </h2>

      {error && <p className="text-sm mb-3 text-red">{error}</p>}

      {accounts.length > 0 ? (
        <div className="flex flex-col gap-2 mb-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm"
            >
              <span>
                {account.linkedEmail}
                {account.connectedByName ? ` — added by ${account.connectedByName}` : ""}
              </span>
              {isPrivileged && (
                <button
                  type="button"
                  onClick={() => handleRemove(account.id)}
                  disabled={isPending}
                  className="text-ink-light hover:text-red text-xs cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-light mb-3">
          No Amazon accounts linked yet.
        </p>
      )}

      {isPrivileged ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-light">
            Add the email on any Amazon account your Echo devices use. That&apos;s
            what Alexa hands back when someone says &quot;add milk&quot; — link it here
            so voice add works for the whole household, no separate WeeklyNom
            login required. You can link more than one account.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !email.trim()}
              className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-ink-light">
          Ask an owner or manager to link your household&apos;s Amazon account for
          Alexa voice add.
        </p>
      ) : null}
    </section>
  );
}
