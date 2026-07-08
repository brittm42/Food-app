"use client";

import { useState, useTransition } from "react";

export default function RemoveDependentButton({
  memberId,
  onRemove,
}: {
  memberId: string;
  onRemove: (memberId: string) => Promise<{ error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await onRemove(memberId);
      if (result?.error) {
        setError(result.error);
      } else {
        // A plain router.push() can serve a stale client-side Router Cache
        // entry for /account/household if it was visited earlier in this
        // session (revalidatePath doesn't reliably bust that cache across
        // a cross-page navigation) — a full navigation guarantees fresh data.
        window.location.href = "/account/household";
      }
    });
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="text-sm text-red hover:underline cursor-pointer disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Remove this profile"}
      </button>
      {error && <p className="text-sm text-red mt-2">{error}</p>}
    </div>
  );
}
