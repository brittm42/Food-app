// Throwaway verification helper: exchanges an admin-generated magic link's
// access/refresh tokens for a full Session (with user object) via a real
// supabase-js client, then base64url-encodes it exactly as @supabase/ssr's
// createBrowserClient would, so it can be handed to Playwright as a
// pre-set `sb-<project-ref>-auth-token` cookie — auth without ever touching
// Gmail (see AGENTS.md's documented technique for auth-gated verification).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [accessToken, refreshToken] = process.argv.slice(2);

let captured = null;
const client = createClient(url, anonKey, {
  auth: {
    storage: {
      getItem: () => null,
      setItem: (_key, value) => {
        captured = value;
      },
      removeItem: () => {},
    },
  },
});

const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
if (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
}
if (!captured) {
  console.error(JSON.stringify({ error: "No session captured." }));
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const fullValue = "base64-" + Buffer.from(captured, "utf8").toString("base64url");

// Mirrors @supabase/ssr's createChunks (utils/chunker.js): split into
// `<name>.0`, `<name>.1`, ... at MAX_CHUNK_SIZE (3180) once the value
// exceeds a single cookie's practical size. base64url output has no
// characters that encodeURIComponent would escape, so a plain slice is
// equivalent to their escape-aware chunking here.
const MAX_CHUNK_SIZE = 3180;
const cookies =
  fullValue.length <= MAX_CHUNK_SIZE
    ? [{ name: cookieName, value: fullValue }]
    : Array.from({ length: Math.ceil(fullValue.length / MAX_CHUNK_SIZE) }, (_, i) => ({
        name: `${cookieName}.${i}`,
        value: fullValue.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE),
      }));

console.log(JSON.stringify({ cookies }));
