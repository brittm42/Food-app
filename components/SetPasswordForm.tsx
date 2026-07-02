"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordState } from "@/lib/actions/auth";

const initialState: PasswordState = { status: "idle" };

export default function SetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);

  return (
    <div className="mt-6">
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Set or change password
      </h2>
      <p className="text-sm text-ink-light mb-3">
        Add a password so you can sign in without waiting for a magic-link
        email.
      </p>
      <form action={action} className="flex gap-2">
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="New password (min 8 characters)"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {state.status === "success" && (
        <p className="text-sm text-teal mt-2">{state.message}</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red mt-2">{state.message}</p>
      )}
    </div>
  );
}
