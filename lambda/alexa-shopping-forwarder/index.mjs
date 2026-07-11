// Pasted manually into the AWS Lambda console's inline code editor — not
// deployed via CI. Kept here for version control and so this file's
// history explains itself if it needs to change later.
//
// Sits between the Alexa skill and the WeeklyNom Vercel app. Alexa's
// Skills Kit Lambda trigger delivers the parsed Alexa request JSON
// directly as `event` (no HTTP/signature parsing needed here at all —
// trust from Alexa comes from the Lambda trigger being restricted to this
// skill's ID in AWS, not from a cryptographic signature). This function's
// only job is to forward that event to the Vercel endpoint with a shared
// secret, and hand back whatever Vercel returns as the skill response.
//
// Requires two Lambda environment variables:
//   WEEKLYNOM_ENDPOINT_URL   e.g. https://www.weeklynom.com/api/alexa/shopping
//   WEEKLYNOM_SHARED_SECRET  matches ALEXA_LAMBDA_SHARED_SECRET on Vercel

const FALLBACK_RESPONSE = {
  version: "1.0",
  response: {
    outputSpeech: {
      type: "PlainText",
      text: "Sorry, something went wrong reaching WeeklyNom.",
    },
    shouldEndSession: true,
  },
};

export const handler = async (event) => {
  const endpointUrl = process.env.WEEKLYNOM_ENDPOINT_URL;
  const sharedSecret = process.env.WEEKLYNOM_SHARED_SECRET;

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sharedSecret}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      console.error("WeeklyNom endpoint returned non-OK status:", response.status);
      return FALLBACK_RESPONSE;
    }

    return await response.json();
  } catch (err) {
    console.error("Failed to reach WeeklyNom endpoint:", err);
    return FALLBACK_RESPONSE;
  }
};
