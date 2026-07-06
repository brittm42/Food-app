"use client";

import { useState, useTransition } from "react";
import { updateDisplayName } from "@/app/actions/profile";

export default function ProfileNameForm({
  initialName,
}: {
  initialName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDisplayName(name);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Your name"
          maxLength={60}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red mt-2">{error}</p>}
      {saved && !error && <p className="text-sm text-teal mt-2">Saved.</p>}
    </form>
  );
}
