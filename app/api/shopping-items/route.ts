import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { addShoppingItemForHousehold } from "@/lib/shopping";

// Voice quick-add entry point (Siri/Shortcuts now, Alexa via
// app/api/alexa/shopping/route.ts). Not a cookie-authenticated Server
// Action — the caller has no Supabase session, so it's a
// Bearer-token-authenticated Route Handler instead, resolving the token to
// a household via voice_integration_tokens (see
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

  const label = typeof body.label === "string" ? body.label : "";
  const isFood = typeof body.isFood === "boolean" ? body.isFood : true;

  const result = await addShoppingItemForHousehold(admin, tokenRow.household_id, label, isFood);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  revalidatePath("/shopping");
  return NextResponse.json(result);
}
