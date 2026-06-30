"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleOatPick(flavorId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("oat_picks")
    .select("flavor_id")
    .eq("user_id", user.id)
    .eq("flavor_id", flavorId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("oat_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("flavor_id", flavorId);
  } else {
    const { data: picks } = await supabase
      .from("oat_picks")
      .select("flavor_id, picked_at")
      .eq("user_id", user.id)
      .order("picked_at", { ascending: true });

    if (picks && picks.length >= 2) {
      // Picking a 3rd bumps the oldest pick (PRD Feature 8 behavior).
      await supabase
        .from("oat_picks")
        .delete()
        .eq("user_id", user.id)
        .eq("flavor_id", picks[0].flavor_id);
    }

    await supabase.from("oat_picks").insert({ user_id: user.id, flavor_id: flavorId });
  }

  revalidatePath("/");
}
