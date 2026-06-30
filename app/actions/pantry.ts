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
