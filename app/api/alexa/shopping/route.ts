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
    return speech("Something went wrong looking up your account. Please try again.");
  }

  const matchedUser = usersPage.users.find(
    (u) => u.email?.toLowerCase() === linkedEmail.toLowerCase()
  );
  if (!matchedUser) {
    return speech("I couldn't find a WeeklyNom account for your linked email.");
  }

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", matchedUser.id)
    .maybeSingle();

  if (!membership) {
    return speech("I couldn't find a household for your WeeklyNom account.");
  }

  const itemSlot = alexaRequest.intent?.slots?.ItemName?.value;
  const label = typeof itemSlot === "string" ? itemSlot : "";

  const result = await addShoppingItemForHousehold(admin, membership.household_id, label);

  if (!result.ok) {
    return speech("Sorry, I didn't catch what to add. Try saying, add milk.");
  }

  revalidatePath("/shopping");

  if (result.duplicate) {
    return speech(`${result.label} is already on your shopping list.`);
  }

  return speech(`Added ${result.label} to your shopping list.`);
}
