"use client";

import { useTransition } from "react";
import { disconnectKroger } from "@/app/actions/kroger";

export default function KrogerConnectionPanel({
  connected,
  connectedByName,
  isPrivileged,
  notice,
}: {
  connected: boolean;
  connectedByName: string | null;
  isPrivileged: boolean;
  notice: { kind: "connected" | "error"; message: string } | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(() => {
      disconnectKroger();
    });
  }

  return (
    <section className="mt-8 pt-6 border-t border-border">
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Kroger / King Soopers
      </h2>

      {notice && (
        <p className={`text-sm mb-3 ${notice.kind === "error" ? "text-red" : "text-teal"}`}>
          {notice.message}
        </p>
      )}

      {connected ? (
        <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm">
          <span>
            Connected{connectedByName ? ` by ${connectedByName}` : ""}
          </span>
          {isPrivileged && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="text-ink-light hover:text-red text-xs cursor-pointer disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      ) : isPrivileged ? (
        <>
          <p className="text-sm text-ink-light mb-2">
            Connect your household&apos;s Kroger/King Soopers account to send
            the Shopping List straight to your real cart.
          </p>
          <a
            href="/api/kroger/connect?returnTo=/account/household"
            className="inline-block bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            Connect Kroger
          </a>
        </>
      ) : (
        <p className="text-sm text-ink-light">
          Not connected. Ask an owner or manager to connect your household&apos;s
          Kroger account.
        </p>
      )}
    </section>
  );
}
