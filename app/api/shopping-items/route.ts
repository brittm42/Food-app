import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Voice quick-add entry point (Siri/Shortcuts now, Alexa later). Not a
// cookie-authenticated Server Action — the caller has no Supabase session,
// so it's a Bearer-token-authenticated Route Handler instead, resolving the
// token to a household via voice_integration_tokens (see
// supabase/voice-integration-tokens.sql). /api is public in proxy.ts so the
// tokenless request isn't redirected to /login before reaching this code.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("voice_integration_tokens")
    .select("household_id")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  let body: { label?: unknown; isFood?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "Enter an item name." }, { status: 400 });
  }
  const isFood = typeof body.isFood === "boolean" ? body.isFood : true;

  // A voice add should behave like a real list: saying an item that's
  // already sitting there unchecked is a no-op, not a second row. Unlike the
  // manual UI (typing the same label twice does create a duplicate today),
  // voice input has no visual feedback for "wait, is that already on
  // there?", so silently skipping duplicates matters more here.
  // Escape ilike's own wildcard characters so a literal label like
  // "2% milk" or "family_size chips" doesn't get treated as a pattern.
  const escapedLabel = label.replace(/[%_]/g, (char) => `\\${char}`);

  const { data: existing } = await admin
    .from("shopping_items")
    .select("id")
    .eq("household_id", tokenRow.household_id)
    .ilike("label", escapedLabel)
    .maybeSingle();

  if (existing) {
    revalidatePath("/shopping");
    return NextResponse.json({ ok: true, label, duplicate: true });
  }

  const { error } = await admin.from("shopping_items").insert({
    household_id: tokenRow.household_id,
    label,
    is_food: isFood,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/shopping");
  return NextResponse.json({ ok: true, label });
}
