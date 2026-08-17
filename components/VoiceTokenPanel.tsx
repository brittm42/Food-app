"use client";

import { useState, useTransition } from "react";
import { generateMyVoiceToken, type VoiceToken } from "@/app/actions/voice-token";

export default function VoiceTokenPanel({ initialToken }: { initialToken: VoiceToken | null }) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateMyVoiceToken();
      if ("error" in result) {
        setError(result.error);
      } else {
        setToken(result);
        setCopied(false);
      }
    });
  }

  function copy() {
    if (!token) return;
    navigator.clipboard.writeText(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-light">
          Generate a token to paste into the Shortcut below — you only need to do this once.
        </p>
        {error && <p className="text-sm text-red">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="self-start bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate my token"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 bg-surface border border-border rounded-lg px-3 py-2">
        <code className="text-sm truncate">{token.token}</code>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-medium text-teal shrink-0 cursor-pointer"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="self-start text-ink-light hover:text-red text-xs cursor-pointer disabled:opacity-50"
      >
        {isPending ? "Regenerating…" : "Regenerate (invalidates the old token)"}
      </button>
    </div>
  );
}
