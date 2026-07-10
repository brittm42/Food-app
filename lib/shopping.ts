import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeItem } from "@/lib/categorize";

// Shared by both voice entry points (Shortcuts' /api/shopping-items and
// Alexa's /api/alexa/shopping) — neither has a Supabase session, so both
// call this with an admin (service-role) client and an already-resolved
// household_id.
export async function addShoppingItemForHousehold(
  admin: SupabaseClient,
  householdId: string,
  rawLabel: string
): Promise<{ ok: true; label: string; duplicate?: boolean } | { ok: false; error: string }> {
  const label = rawLabel.trim();
  if (!label) {
    return { ok: false, error: "Enter an item name." };
  }

  // A voice add should behave like a real list: saying an item that's
  // already sitting there unchecked is a no-op, not a second row. Escape
  // ilike's own wildcard characters so a literal label like "2% milk" or
  // "family_size chips" doesn't get treated as a pattern.
  const escapedLabel = label.replace(/[%_]/g, (char) => `\\${char}`);

  const { data: existing } = await admin
    .from("shopping_items")
    .select("id")
    .eq("household_id", householdId)
    .ilike("label", escapedLabel)
    .maybeSingle();

  if (existing) {
    return { ok: true, label, duplicate: true };
  }

  const category = await categorizeItem(label);
  const { error } = await admin.from("shopping_items").insert({
    household_id: householdId,
    label,
    category,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, label };
}
