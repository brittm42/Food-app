import crypto from "crypto";

// Hand-rolled replacement for the alexa-verifier npm package — after ruling
// out body-encoding and middleware-boundary corruption (see git history on
// app/api/alexa/shopping/route.ts) as causes of a persistent "invalid
// signature" on genuinely Amazon-signed requests, this exists to get full
// visibility into every step (which the third-party package's implicit
// PEM-string-as-public-key handling in crypto.Verify.verify() didn't give)
// rather than trust a black box further. Same checks Amazon's own docs
// require: https cert URL from s3.amazonaws.com/echo.api/, valid cert
// dates, echo-api.amazon.com in the SAN, timestamp within tolerance, and
// the RSA-SHA256 signature itself over the raw request bytes.
const VALID_CERT_SAN = "echo-api.amazon.com";
const VALID_CERT_HOSTNAME = "s3.amazonaws.com";
const VALID_CERT_PATH_PREFIX = "/echo.api/";
const TIMESTAMP_TOLERANCE_SECONDS = 150;

export async function verifyAlexaRequest(
  certUrl: string,
  signature: string,
  rawBody: Buffer,
  requestTimestamp: string
): Promise<void> {
  const parsed = new URL(certUrl);
  if (parsed.protocol !== "https:") {
    throw new Error(`cert url must be https, got ${parsed.protocol}`);
  }
  if (parsed.hostname.toLowerCase() !== VALID_CERT_HOSTNAME) {
    throw new Error(`cert url hostname must be ${VALID_CERT_HOSTNAME}, got ${parsed.hostname}`);
  }
  if (parsed.port && parsed.port !== "443") {
    throw new Error(`cert url port must be 443, got ${parsed.port}`);
  }
  if (!parsed.pathname.startsWith(VALID_CERT_PATH_PREFIX)) {
    throw new Error(`cert url path must start with ${VALID_CERT_PATH_PREFIX}, got ${parsed.pathname}`);
  }

  const requestTimeMs = new Date(requestTimestamp).getTime();
  if (Number.isNaN(requestTimeMs)) {
    throw new Error(`unparseable request timestamp: ${requestTimestamp}`);
  }
  const ageSeconds = (Date.now() - requestTimeMs) / 1000;
  if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new Error(`request timestamp too old: ${requestTimestamp} (${ageSeconds}s ago)`);
  }

  const certResponse = await fetch(certUrl);
  if (!certResponse.ok) {
    throw new Error(`cert fetch failed: ${certResponse.status}`);
  }
  const pemCert = await certResponse.text();

  const cert = new crypto.X509Certificate(pemCert);

  const now = new Date();
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
    throw new Error(`cert not valid now (validFrom=${cert.validFrom}, validTo=${cert.validTo})`);
  }

  const san = cert.subjectAltName ?? "";
  if (!san.includes(VALID_CERT_SAN)) {
    throw new Error(`cert SAN missing ${VALID_CERT_SAN}: ${san}`);
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(rawBody);
  const isValid = verifier.verify(cert.publicKey, signature, "base64");
  if (!isValid) {
    throw new Error("signature does not match request body");
  }
}
