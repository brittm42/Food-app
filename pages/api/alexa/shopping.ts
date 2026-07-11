import type { NextApiRequest, NextApiResponse } from "next";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { addShoppingItemForHousehold } from "@/lib/shopping";

// Not called directly by Alexa. Alexa's byte-exact signature requirement
// couldn't be satisfied on Vercel (confirmed via three independent
// verification implementations, including raw openssl, that Vercel's
// platform layer alters the request body before any Node.js code sees
// it — see git history on this file and lib/alexa-verify.ts, since
// deleted). Trust now comes from an AWS Lambda function in front of this
// route: Alexa invokes Lambda (trust via an IAM trigger restricted to the
// skill ID, not a signature), and Lambda forwards here with a shared
// secret, same Bearer pattern as app/api/shopping-items/route.ts.
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!providedSecret || providedSecret !== process.env.ALEXA_LAMBDA_SHARED_SECRET) {
    res.status(401).json({ error: "Invalid or missing shared secret." });
    return;
  }

  const payload = req.body as AlexaRequestBody;

  function speech(text: string, shouldEndSession = true) {
    res.status(200).json({
      version: "1.0",
      response: {
        outputSpeech: { type: "PlainText", text },
        shouldEndSession,
      },
    });
  }

  const alexaRequest = payload.request;
  if (!alexaRequest) {
    res.status(400).json({ error: "Missing request field." });
    return;
  }

  if (alexaRequest.type === "SessionEndedRequest") {
    res.status(200).json({ version: "1.0", response: {} });
    return;
  }

  if (alexaRequest.type === "LaunchRequest") {
    speech("You can say, add milk, to add something to your shopping list.", false);
    return;
  }

  if (alexaRequest.type !== "IntentRequest") {
    speech("Sorry, I didn't understand that.");
    return;
  }

  const intentName = alexaRequest.intent?.name;

  if (intentName === "AMAZON.HelpIntent") {
    speech("Say something like, add milk, and I'll add it to your shopping list.", false);
    return;
  }

  if (intentName === "AMAZON.CancelIntent" || intentName === "AMAZON.StopIntent") {
    speech("Okay.");
    return;
  }

  if (intentName !== "AddShoppingItemIntent") {
    speech("Sorry, I didn't understand that. Try saying, add milk.");
    return;
  }

  const accessToken = payload.context?.System?.user?.accessToken;
  if (!accessToken) {
    speech(
      "Your WeeklyNom account isn't linked yet. Please open the Alexa app and link your account for this skill."
    );
    return;
  }

  try {
    const profileResponse = await fetch("https://api.amazon.com/user/profile", {
      headers: { Authorization: `bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      speech("I couldn't verify your account. Please try linking it again in the Alexa app.");
      return;
    }

    const profile: { email?: string } = await profileResponse.json();
    if (!profile.email) {
      speech("I couldn't find an email on your linked account.");
      return;
    }
    const linkedEmail = profile.email;

    const admin = createAdminClient();

    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) {
      speech(`Account lookup failed: ${listError.message}`);
      return;
    }

    const matchedUser = usersPage.users.find(
      (u) => u.email?.toLowerCase() === linkedEmail.toLowerCase()
    );
    if (!matchedUser) {
      speech("I couldn't find a WeeklyNom account for your linked email.");
      return;
    }

    const { data: membership, error: membershipError } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", matchedUser.id)
      .maybeSingle();

    if (membershipError) {
      speech(`Household lookup failed: ${membershipError.message}`);
      return;
    }
    if (!membership) {
      speech("I couldn't find a household for your WeeklyNom account.");
      return;
    }

    const itemSlot = alexaRequest.intent?.slots?.ItemName?.value;
    const rawLabel = typeof itemSlot === "string" ? itemSlot : "";
    const items = splitItems(rawLabel);

    if (items.length === 0) {
      speech("Sorry, I didn't catch what to add. Try saying, add milk.");
      return;
    }

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
      speech("Sorry, I didn't catch what to add. Try saying, add milk.");
      return;
    }

    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`Added ${joinWithAnd(added)} to your shopping list.`);
    }
    if (duplicates.length > 0) {
      const verb = duplicates.length === 1 ? "was" : "were";
      parts.push(`${joinWithAnd(duplicates)} ${verb} already on the list.`);
    }

    speech(parts.join(" "));
  } catch (err) {
    console.error("Alexa intent handling failed:", err);
    speech(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
  }
}
