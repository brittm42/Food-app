import type { NextApiRequest, NextApiResponse } from "next";
import { revalidatePath } from "next/cache";
import { verifyAlexaRequest } from "@/lib/alexa-verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { addShoppingItemForHousehold } from "@/lib/shopping";

// Pages Router API route, not an App Router Route Handler — deliberately.
// App Router's Request/NextRequest wrapping was a live suspect for
// corrupting Alexa's request bytes before signature verification could run
// (confirmed via openssl, independent of any app code, that the bytes
// captured in app/api/alexa/shopping/route.ts didn't match the signature
// even though the certificate itself checked out). Pages API routes with
// bodyParser disabled read the raw Node.js IncomingMessage stream directly,
// with none of the App Router's request-object reconstruction in the way —
// the same reason this style is the standard recommendation for Stripe
// webhook signature verification, which has the identical byte-exact
// requirement.
export const config = {
  api: {
    bodyParser: false,
  },
};

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

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

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

  const rawBody = await readRawBody(req);

  const certUrl = req.headers["signaturecertchainurl"];
  const signature = req.headers["signature"];

  if (typeof certUrl !== "string" || typeof signature !== "string") {
    res.status(400).json({ error: "Missing signature headers." });
    return;
  }

  let payload: AlexaRequestBody;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  const requestTimestamp = payload.request?.timestamp;
  if (!requestTimestamp) {
    res.status(400).json({ error: "Missing request timestamp." });
    return;
  }

  try {
    await verifyAlexaRequest(certUrl, signature, rawBody, requestTimestamp);
  } catch (err) {
    console.error("Alexa signature verification failed:", err, "certUrl:", certUrl);
    res.status(401).json({ error: `Signature verification failed: ${String(err)}` });
    return;
  }

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
