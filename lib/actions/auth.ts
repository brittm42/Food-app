"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function updatePassword(
  _prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "success", message: "Password updated." };
}
