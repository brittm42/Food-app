import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever use from Server
// Actions / Route Handlers, never from a Client Component. Extends the
// same pattern scripts/seed.mjs uses for trusted server-side operations
// that need to read/write past RLS (here: household_invites, which has no
// client-facing RLS policies at all since an invited person isn't
// authenticated yet when they need to resolve their invite token).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}
