"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/household";

export default function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="bg-ink text-white rounded-lg py-2 px-4 text-sm font-medium cursor-pointer disabled:opacity-50"
      >
        {isPending ? "Joining…" : "Join household"}
      </button>
      {error && <p className="text-sm text-red mt-3">{error}</p>}
    </div>
  );
}
