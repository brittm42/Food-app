// Creates a standalone test/demo account for handing to an external
// reviewer (e.g. pasting credentials into a fresh Claude Desktop chat).
// Bypasses the normal magic-link signup + lazy household creation
// (lib/supabase/proxy.ts) so the account is immediately usable — real
// password auth, a household already provisioned, onboarding marked
// complete, and a handful of pantry items + This Week recipes so the app
// doesn't look empty.
//
// Safe to re-run: deletes any existing user with the same email (and its
// household, since household_members cascades from auth.users) before
// recreating from scratch. That's also how you "wipe it clean" later —
// just run this again.
//
// Run with: node --env-file=.env.local scripts/create-test-account.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/create-test-account.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);

const EMAIL = "brittany.madruga+clauderesview@gmail.com";
const PASSWORD = crypto.randomBytes(9).toString("base64url"); // 12 chars, url-safe

// A representative slice of the CORE_PANTRY / WEEKLY_FRESH lists (see
// scripts/seed-pantry-items.mjs) rather than the full set — enough
// category variety for Kitchen/Shopping to look real without a slow,
// API-metered categorization pass over ~60 items.
const PANTRY_ITEMS = [
  { name: "Black beans", category: "Canned Goods", item_type: "core", target_qty: 4, target_unit: "can", on_hand_qty: 4, on_hand_unit: "can" },
  { name: "Diced tomatoes", category: "Canned Goods", item_type: "core", target_qty: 4, target_unit: "can", on_hand_qty: 1, on_hand_unit: "can" },
  { name: "Brown rice", category: "Grains & Dried", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Red lentils", category: "Grains & Dried", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Olive oil", category: "Sauces & Condiments", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Soy sauce", category: "Sauces & Condiments", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Cumin", category: "Spices", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Smoked paprika", category: "Spices", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Frozen spinach", category: "Frozen", item_type: "core", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Baby spinach", category: "Produce", item_type: "weekly_fresh", target_qty: 1, target_unit: "package", on_hand_qty: null, on_hand_unit: null },
  { name: "Bananas", category: "Produce", item_type: "weekly_fresh", target_qty: 1, target_unit: "bunch", on_hand_qty: null, on_hand_unit: null },
  { name: "Avocados", category: "Produce", item_type: "weekly_fresh", target_qty: 4, target_unit: "whole", on_hand_qty: 2, on_hand_unit: "whole" },
  { name: "Eggs", category: "Dairy & Eggs", item_type: "weekly_fresh", target_qty: 1, target_unit: "package", on_hand_qty: null, on_hand_unit: null },
  { name: "Cheese", category: "Dairy & Eggs", item_type: "weekly_fresh", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
  { name: "Chicken thighs", category: "Meat & Seafood", item_type: "weekly_fresh", target_qty: null, target_unit: null, on_hand_qty: null, on_hand_unit: null },
];

// --- 1. Wipe any existing account with this email (idempotent re-run) ---

const { data: existingList } = await supabase.auth.admin.listUsers();
const existing = existingList?.users.find((u) => u.email === EMAIL);
if (existing) {
  console.log(`Deleting existing test account ${existing.id}...`);
  await supabase.auth.admin.deleteUser(existing.id);
}

// --- 2. Create the auth user ---

const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (userError) {
  console.error("Failed to create user:", userError.message);
  process.exit(1);
}
const userId = userData.user.id;
console.log(`Created auth user ${userId}.`);

// --- 3. Household + membership (mirrors the lazy-create in lib/supabase/proxy.ts) ---

const householdId = crypto.randomUUID();
const { error: householdError } = await supabase
  .from("households")
  .insert({ id: householdId, name: "Claude Review Household" });
if (householdError) {
  console.error("Failed to create household:", householdError.message);
  process.exit(1);
}

const { error: memberError } = await supabase
  .from("household_members")
  .insert({ household_id: householdId, user_id: userId, role: "owner" });
if (memberError) {
  console.error("Failed to create household_members row:", memberError.message);
  process.exit(1);
}
console.log(`Created household ${householdId}.`);

// --- 4. Profile (onboarding already completed) ---

const { error: profileError } = await supabase.from("profiles").insert({
  user_id: userId,
  display_name: "Claude Reviewer",
  allergies: [],
  avoid_foods: [],
  cuisine_preferences: ["Italian", "Mexican", "Thai"],
  onboarding_status: "completed",
});
if (profileError) {
  console.error("Failed to create profile:", profileError.message);
  process.exit(1);
}
console.log("Created profile.");

// --- 5. Pantry items ---

const pantryRows = PANTRY_ITEMS.map((item) => ({ household_id: householdId, ...item }));
const { error: pantryError } = await supabase.from("pantry_items").insert(pantryRows);
if (pantryError) {
  console.error("Failed to seed pantry_items:", pantryError.message);
  process.exit(1);
}
console.log(`Seeded ${pantryRows.length} pantry_items rows.`);

// --- 6. A few This Week recipes, pulled from the shared seed library ---

const { data: seedRecipes, error: recipesError } = await supabase
  .from("recipes")
  .select("id")
  .eq("is_seed", true)
  .limit(3);
if (recipesError) {
  console.error("Failed to look up seed recipes:", recipesError.message);
  process.exit(1);
}

if (seedRecipes?.length) {
  const weekQueueRows = seedRecipes.map((r) => ({
    household_id: householdId,
    user_id: userId,
    recipe_id: r.id,
  }));
  const { error: weekQueueError } = await supabase.from("week_queue").insert(weekQueueRows);
  if (weekQueueError) {
    console.error("Failed to seed week_queue:", weekQueueError.message);
    process.exit(1);
  }
  console.log(`Added ${weekQueueRows.length} recipes to This Week.`);
} else {
  console.log("No is_seed recipes found — This Week left empty.");
}

console.log("\nDone. Credentials for the reviewer:\n");
console.log(`  URL:      https://weeklynom.com`);
console.log(`  Email:    ${EMAIL}`);
console.log(`  Password: ${PASSWORD}`);
