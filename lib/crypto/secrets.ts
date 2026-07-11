import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Generic at-rest encryption for sensitive tokens/secrets we need to store
// in Supabase but never want sitting there as plaintext (currently: Kroger's
// OAuth refresh/access tokens in kroger_connections). Not tied to any one
// integration — the next thing that needs real secret storage (an eventual
// checkout flow, another retailer, billing credentials) should reuse this
// rather than rolling its own scheme.
//
// TOKEN_ENCRYPTION_KEY is a 32-byte key, base64-encoded (e.g. generated with
// `openssl rand -base64 32`).

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const encoded = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

// Packs iv:authTag:ciphertext (each base64) into one string column.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(":");
}

export function decrypt(packed: string): string {
  const [ivB64, authTagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed ciphertext.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
