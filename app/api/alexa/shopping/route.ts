import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import alexaVerifier from "alexa-verifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { addShoppingItemForHousehold } from "@/lib/shopping";

type AlexaRequestBody = {
  request?: {
    type: string;
    intent?: {
      name: string;
      slots?: Record<string, { name: string; value?: string }>;
    };
  };
  context?: {
    System?: {
      user?: { accessToken?: string };
    };
  };
};

function speech(text: string, shouldEndSession = true) {
  return NextResponse.json({
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text },
      shouldEndSession,
    },
  });
}

// ItemName is AMAZON.SearchQuery, which Alexa doesn't allow as a multi-value
// slot (it's excluded specifically because it's meant for broad free-text
// capture) — so "add milk, eggs, and bread" arrives as one raw string that
// we split ourselves. Only split on commas, and only treat a trailing
// "and X" as a separate item once a comma has already established we're in
// a list — a bare "mac and cheese" (no comma) has no way to be
// distinguished from a real two-item "milk and eggs", so it's left intact
// rather than risk mangling a compound food name.
function splitItems(raw: string): string[] {
  const commaParts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length <= 1) return commaParts;

  const last = commaParts.pop()!.replace(/^and\s+/i, "");
  const lastParts = last
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return [...commaParts, ...lastParts];
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Alexa entry point for voice quick-add ("Alexa, tell weekly nom to add
// milk"). Unlike the Shortcuts endpoint (app/api/shopping-items/route.ts),
// this isn't Bearer-token authenticated — Amazon signs every request with a
// certificate chain instead, verified below via alexa-verifier before any
// of the payload is trusted. The caller's identity comes from account
// linking (Login with Amazon): Alexa hands back an LWA access token, which
// is exchanged here for the linked email to resolve a household.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const certUrl = request.headers.get("signaturecertchainurl");
  const signature = request.headers.get("signature");

  if (!certUrl || !signature) {
    return NextResponse.json({ error: "Missing signature headers." }, { status: 400 });
  }

  try {
    await alexaVerifier(certUrl, signature, rawBody);
  } catch (err) {
    console.error("Alexa signature verification failed:", err, "certUrl:", certUrl);
    return NextResponse.json(
      { error: `Signature verification failed: ${String(err)}` },
      { status: 401 }
    );
  }

  let payload: AlexaRequestBody;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const alexaRequest = payload.request;
  if (!alexaRequest) {
    return NextResponse.json({ error: "Missing request field." }, { status: 400 });
  }

  if (alexaRequest.type === "SessionEndedRequest") {
    return NextResponse.json({ version: "1.0", response: {} });
  }

  if (alexaRequest.type === "LaunchRequest") {
    return speech("You can say, add milk, to add something to your shopping list.", false);
  }

  if (alexaRequest.type !== "IntentRequest") {
    return speech("Sorry, I didn't understand that.");
  }

  const intentName = alexaRequest.intent?.name;

  if (intentName === "AMAZON.HelpIntent") {
    return speech("Say something like, add milk, and I'll add it to your shopping list.", false);
  }

  if (intentName === "AMAZON.CancelIntent" || intentName === "AMAZON.StopIntent") {
    return speech("Okay.");
  }

  if (intentName !== "AddShoppingItemIntent") {
    return speech("Sorry, I didn't understand that. Try saying, add milk.");
  }

  const accessToken = payload.context?.System?.user?.accessToken;
  if (!accessToken) {
    return speech(
      "Your WeeklyNom account isn't linked yet. Please open the Alexa app and link your account for this skill."
    );
  }

  // Everything below makes external calls (LWA, Supabase) that can throw —
  // an uncaught exception here means Next.js returns a generic 500 instead
  // of a valid Alexa response shape, which Alexa reports back as a bare
  // "INVALID_RESPONSE" with no detail. Catch broadly and speak back
  // whatever went wrong so a failure is diagnosable without server log
  // access.
  try {
    const profileResponse = await fetch("https://api.amazon.com/user/profile", {
      headers: { Authorization: `bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      return speech("I couldn't verify your account. Please try linking it again in the Alexa app.");
    }

    const profile: { email?: string } = await profileResponse.json();
    if (!profile.email) {
      return speech("I couldn't find an email on your linked account.");
    }
    const linkedEmail = profile.email;

    const admin = createAdminClient();

    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) {
      return speech(`Account lookup failed: ${listError.message}`);
    }

    const matchedUser = usersPage.users.find(
      (u) => u.email?.toLowerCase() === linkedEmail.toLowerCase()
    );
    if (!matchedUser) {
      return speech("I couldn't find a WeeklyNom account for your linked email.");
    }

    const { data: membership, error: membershipError } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", matchedUser.id)
      .maybeSingle();

    if (membershipError) {
      return speech(`Household lookup failed: ${membershipError.message}`);
    }
    if (!membership) {
      return speech("I couldn't find a household for your WeeklyNom account.");
    }

    const itemSlot = alexaRequest.intent?.slots?.ItemName?.value;
    const rawLabel = typeof itemSlot === "string" ? itemSlot : "";
    const items = splitItems(rawLabel);

    if (items.length === 0) {
      return speech("Sorry, I didn't catch what to add. Try saying, add milk.");
    }

    // Sequential, not Promise.all — if the same item is said twice in one
    // sentence (or twice via imperfect speech recognition), each insert
    // needs to see the previous one's dedup check land before the next runs.
    const added: string[] = [];
    const duplicates: string[] = [];
    for (const item of items) {
      const result = await addShoppingItemForHousehold(admin, membership.household_id, item);
      if (!result.ok) continue;
      if (result.duplicate) {
        duplicates.push(result.label);
      } else {
        added.push(result.label);
      }
    }

    revalidatePath("/shopping");

    if (added.length === 0 && duplicates.length === 0) {
      return speech("Sorry, I didn't catch what to add. Try saying, add milk.");
    }

    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`Added ${joinWithAnd(added)} to your shopping list.`);
    }
    if (duplicates.length > 0) {
      const verb = duplicates.length === 1 ? "was" : "were";
      parts.push(`${joinWithAnd(duplicates)} ${verb} already on the list.`);
    }

    return speech(parts.join(" "));
  } catch (err) {
    console.error("Alexa intent handling failed:", err);
    return speech(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
  }
}
