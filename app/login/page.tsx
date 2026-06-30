"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initialState);

  return (
    <div className="max-w-sm mx-auto py-12 px-4">
      <h1 className="font-display text-xl font-light mb-2">Sign in</h1>
      <p className="text-sm text-ink-light mb-6 leading-relaxed">
        Enter your email and we&apos;ll send you a magic link — no password
        needed.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {state.status === "sent" && (
        <p className="text-sm text-teal mt-4">{state.message}</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red mt-4">{state.message}</p>
      )}
    </div>
  );
}
