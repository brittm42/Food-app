"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleChecked(itemKey: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("pantry_state")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_key", itemKey)
    .maybeSingle();

  if (existing) {
    await supabase.from("pantry_state").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("pantry_state")
      .insert({ user_id: user.id, item_key: itemKey });
  }

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}

export async function addStaple(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Enter an item name." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pantry_staples")
    .insert({ user_id: user.id, label: trimmed });

  if (error) return { error: error.message };

  revalidatePath("/pantry");
  revalidatePath("/shopping");
  return {};
}

export async function deleteStaple(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  await supabase
    .from("pantry_staples")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/pantry");
  revalidatePath("/shopping");
}
