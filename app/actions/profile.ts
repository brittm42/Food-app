"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getDisplayName(): Promise<string | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return data?.display_name ?? null;
}

export async function updateDisplayName(name: string) {
  const trimmed = name.trim();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userData.user.id, display_name: trimmed || null },
      { onConflict: "user_id" }
    )
    .select("user_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Could not save your name. Try again." };

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return {};
}
