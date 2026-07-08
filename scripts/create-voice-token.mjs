import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/create-voice-token.mjs \"<household name>\" \"<label>\""
  );
  process.exit(1);
}

const [householdName, label] = process.argv.slice(2);

if (!householdName || !label) {
  console.error(
    'Usage: node --env-file=.env.local scripts/create-voice-token.mjs "<household name>" "<label>"\n' +
      'Example: node --env-file=.env.local scripts/create-voice-token.mjs "Madruga House" "Britt\'s iPhone Shortcut"'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const { data: household, error: householdError } = await supabase
  .from("households")
  .select("id, name")
  .eq("name", householdName)
  .maybeSingle();

if (householdError) {
  console.error("Error looking up household:", householdError.message);
  process.exit(1);
}

if (!household) {
  console.error(`No household found named "${householdName}".`);
  process.exit(1);
}

const token = crypto.randomUUID();

const { error: insertError } = await supabase
  .from("voice_integration_tokens")
  .insert({ household_id: household.id, label, token });

if (insertError) {
  console.error("Error creating token:", insertError.message);
  process.exit(1);
}

console.log(`Created token for "${label}" (household: ${household.name}):`);
console.log(token);
