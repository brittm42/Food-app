import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { addShoppingItemForHousehold } from "@/lib/shopping";

// Not called directly by Alexa. Alexa's byte-exact signature requirement
// couldn't be satisfied on Vercel (confirmed via three independent
// verification implementations, including raw openssl, that Vercel's
// platform layer alters the request body before any Node.js code sees
// it — see git history on this file's old location,
// app/api/alexa/shopping/route.ts, and lib/alexa-verify.ts, since
// deleted). Trust now comes from an AWS Lambda function in front of this
// route: Alexa invokes Lambda (trust via an IAM trigger restricted to the
// skill ID, not a signature), and Lambda forwards here with a shared
// secret, same Bearer pattern as app/api/shopping-items/route.ts.
//
// Briefly lived at pages/api/alexa/shopping.ts (a Pages Router route) —
// that was only needed for the old raw-byte signature verification, which
// no longer exists. Moved back here because revalidatePath() throws
// ("Static generation store missing") when called from a Pages Router API
// route; it's only supported in Server Functions and Route Handlers (see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md).
type AlexaRequestBody = {
  request?: {
    type: string;
    timestamp?: string;
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

function speech(text: string, shouldEndSession = true) {
  return NextResponse.json({
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text },
      shouldEndSession,
    },
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!providedSecret || providedSecret !== process.env.ALEXA_LAMBDA_SHARED_SECRET) {
    return NextResponse.json({ error: "Invalid or missing shared secret." }, { status: 401 });
  }

  let payload: AlexaRequestBody;
  try {
    payload = await request.json();
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
    const linkedEmail = profile.email.toLowerCase();

    const admin = createAdminClient();

    // Household-level lookup, not a WeeklyNom login — see
    // supabase/alexa-linked-accounts.sql. The Amazon account that owns the
    // household's Echo devices doesn't need its own WeeklyNom account; a
    // privileged household member links its email once from
    // /account/household.
    const { data: link, error: linkError } = await admin
      .from("alexa_linked_accounts")
      .select("household_id")
      .eq("linked_email", linkedEmail)
      .maybeSingle();

    if (linkError) {
      return speech(`Household lookup failed: ${linkError.message}`);
    }
    if (!link) {
      return speech(
        "This Amazon account isn't linked to a WeeklyNom household yet. Ask an owner or manager to link it from account settings."
      );
    }

    const itemSlot = alexaRequest.intent?.slots?.ItemName?.value;
    const rawLabel = typeof itemSlot === "string" ? itemSlot : "";
    const items = splitItems(rawLabel);

    if (items.length === 0) {
      return speech("Sorry, I didn't catch what to add. Try saying, add milk.");
    }

    const added: string[] = [];
    const duplicates: string[] = [];
    for (const item of items) {
      const result = await addShoppingItemForHousehold(admin, link.household_id, item);
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
