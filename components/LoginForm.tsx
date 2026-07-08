"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, signInWithPassword, type LoginState } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";

const initialState: LoginState = { status: "idle" };

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? "/";

  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState
  );
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    sendMagicLink,
    initialState
  );

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const redirectTo =
      next && next !== "/"
        ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`
        : `${window.location.origin}/auth/confirm`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <div className="max-w-sm mx-auto py-12 px-4">
      <h1 className="font-display text-xl font-light mb-6">Sign in</h1>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full border border-border rounded-lg py-2 text-sm font-medium cursor-pointer hover:bg-surface-warm"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-ink-light">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form action={passwordAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={passwordPending}
          className="bg-ink text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {passwordPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {passwordState.status === "error" && (
        <p className="text-sm text-red mt-3">{passwordState.message}</p>
      )}

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-ink-light">or get a magic link instead</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <p className="text-sm text-ink-light mb-3 leading-relaxed">
        No password needed — we&apos;ll email you a sign-in link.
      </p>
      <form action={magicLinkAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={magicLinkPending}
          className="border border-border rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50 hover:bg-surface-warm"
        >
          {magicLinkPending ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {magicLinkState.status === "sent" && (
        <p className="text-sm text-teal mt-4">{magicLinkState.message}</p>
      )}
      {magicLinkState.status === "error" && (
        <p className="text-sm text-red mt-4">{magicLinkState.message}</p>
      )}
    </div>
  );
}
