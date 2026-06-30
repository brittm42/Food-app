"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent", message: `Check ${email} for a sign-in link.` };
}
