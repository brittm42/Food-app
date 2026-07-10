// One-time migration: seeds the new `pantry_items` table (see
// supabase/pantry-items-and-categories.sql) for every existing household
// from three old sources:
//   - CORE_PANTRY / WEEKLY_FRESH (static config in lib/types.ts, inlined
//     below — scripts in this repo don't import from lib/, see
//     backfill-quantity-values.mjs)
//   - the `pantry_staples` table (per-household user-added items)
//   - the `pantry_on_hand` table (on-hand qty for CORE_PANTRY items, by
//     normalized name) — copied onto the new core pantry_items rows, but
//     pantry_on_hand itself is left untouched (still used by recipe-driven
//     reconciliation in app/shopping/page.tsx).
//
// Idempotent: skips any household that already has pantry_items rows, so
// it's safe to re-run.
//
// Run with: node --env-file=.env.local scripts/seed-pantry-items.mjs

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/seed-pantry-items.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// --- inlined from lib/types.ts ---

const CORE_PANTRY = [
  { category: "Canned Goods", items: ["Black beans (4 cans)", "Chickpeas (4 cans)", "Cannellini beans (2 cans)", "Diced tomatoes (4 cans)", "Coconut milk (2 cans)", "Veggie broth (2 cartons)"] },
  { category: "Grains & Dried", items: ["Brown rice (large bag)", "Farro", "Soba noodles", "Rolled oats (large)", "Red lentils", "Green or brown lentils", "Pasta (2 shapes)"] },
  { category: "Sauces & Condiments", items: ["Soy sauce", "White miso paste (fridge)", "Tahini", "Sesame oil", "Rice vinegar", "Jarred salsa", "Olive oil (big bottle)", "Chili crisp", "Hot sauce"] },
  { category: "Spices", items: ["Cumin", "Smoked paprika", "Turmeric", "Dried oregano", "Garlic powder", "Chili powder", "Cinnamon", "Everything bagel seasoning", "Dried dill"] },
  { category: "Freezer Always", items: ["Shelled edamame (large bag)", "Frozen spinach", "Frozen mixed berries", "Frozen mango chunks", "Frozen corn", "Frozen bananas (peel + freeze ripe ones)"] },
  { category: "Pantry Snacks & Extras", items: ["Almond or peanut butter", "Hemp seeds", "Chia seeds", "Whole grain crackers", "Mixed nuts", "Granola", "Seaweed snack packs", "Large flour tortillas", "Taco seasoning", "Cocoa powder", "Canned diced peaches"] },
];

const WEEKLY_FRESH = [
  { label: "Baby spinach (large bag)", note: "" },
  { label: "Bananas (bunch)", note: "" },
  { label: "Lemons (3–4)", note: "" },
  { label: "Garlic (1 head)", note: "" },
  { label: "Salmon fillet (1–2)", note: "for the week" },
  { label: "Hummus (1–2 containers)", note: "" },
  { label: "Eggs (dozen)", note: "Britt only" },
  { label: "Avocados (3–4)", note: "" },
  { label: "Cheese (block or shredded)", note: "" },
  { label: "Whatever veg you're roasting Sunday", note: "sweet potato, broccoli, zucchini" },
  { label: "Cherry tomatoes", note: "" },
  { label: "Cucumber", note: "" },
  { label: "Chicken thighs or breast", note: "family protein" },
  { label: "Fresh berries or fruit", note: "oats + snacks" },
  { label: "Green onions", note: "" },
  { label: "Pita or naan", note: "" },
];

// Old CORE_PANTRY category names -> new shared grocery-aisle taxonomy.
// "Freezer Always" and "Pantry Snacks & Extras" don't map 1:1 onto the new
// list, so those two get per-item categorization below like Weekly
// Fresh/Staples do; everything else carries over unchanged (identical name
// in both taxonomies).
const CORE_CATEGORY_MAP = {
  "Canned Goods": "Canned Goods",
  "Grains & Dried": "Grains & Dried",
  "Sauces & Condiments": "Sauces & Condiments",
  Spices: "Spices",
};

const UNIT_DEFS = { g: 1, kg: 1, oz: 1, lb: 1, ml: 1, l: 1, tsp: 1, tbsp: 1, cup: 1, can: 1, clove: 1, whole: 1, package: 1, bunch: 1 };
const UNIT_SYNONYMS = {
  gram: "g", grams: "g", kilogram: "kg", kilograms: "kg", kgs: "kg",
  ounce: "oz", ounces: "oz", ozs: "oz", pound: "lb", pounds: "lb", lbs: "lb",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  teaspoon: "tsp", teaspoons: "tsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  cups: "cup", cans: "can", cloves: "clove", packages: "package", pack: "package", packs: "package", bunches: "bunch",
};

function canonicalizeUnit(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key in UNIT_DEFS) return key;
  if (key in UNIT_SYNONYMS) return UNIT_SYNONYMS[key];
  return null;
}

// Splits "Black beans (4 cans)" -> { name: "Black beans", qty: 4, unit: "can" }.
// Only handles the small set of patterns actually present in CORE_PANTRY/
// WEEKLY_FRESH ("N unit(s)", "N cartons", bare "large bag"/"big bottle"
// hints with no number). Anything it can't confidently parse just gets a
// clean name and a null target — never a guessed number.
function parseBakedInQty(label) {
  const match = label.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!match) return { name: label.trim(), qty: null, unit: null };
  const name = match[1].trim();
  const hint = match[2].trim();
  const numMatch = hint.match(/^(\d+)[\s–-]*(\d+)?\s*([a-zA-Z]+)?$/);
  if (numMatch) {
    const n = Number(numMatch[2] ?? numMatch[1]); // range "3–4" -> take the higher end
    const unit = canonicalizeUnit(numMatch[3]);
    if (!Number.isNaN(n) && unit) return { name, qty: n, unit };
  }
  return { name, qty: null, unit: null };
}

// --- end inline ---

const categoryCache = new Map();
async function categorize(name) {
  if (categoryCache.has(name)) return categoryCache.get(name);
  const category = await categorizeViaClaude(name);
  categoryCache.set(name, category);
  return category;
}

const CATEGORIES = ["Produce", "Dairy & Eggs", "Meat & Seafood", "Frozen", "Bakery", "Canned Goods", "Grains & Dried", "Sauces & Condiments", "Spices", "Beverages", "Snacks", "Household & Non-food", "Other"];

async function categorizeViaClaude(name) {
  if (!anthropic) return "Other";
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 128,
      tools: [
        {
          name: "categorize_item",
          description: "Assign the single best-fit grocery-aisle category to a pantry/shopping list item.",
          input_schema: {
            type: "object",
            properties: { category: { type: "string", enum: CATEGORIES } },
            required: ["category"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "categorize_item" },
      messages: [{ role: "user", content: name }],
    });
    const toolUse = message.content.find((b) => b.type === "tool_use");
    const category = toolUse?.input?.category;
    return CATEGORIES.includes(category) ? category : "Other";
  } catch (err) {
    console.warn(`  categorize("${name}") failed: ${err.message}`);
    return "Other";
  }
}

const { data: households, error: householdsError } = await supabase.from("households").select("id, name");
if (householdsError) {
  console.error(householdsError);
  process.exit(1);
}

let totalInserted = 0;

for (const household of households) {
  const { count } = await supabase
    .from("pantry_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.id);
  if (count > 0) {
    console.log(`Skipping "${household.name}" (${household.id}) — already has ${count} pantry_items rows.`);
    continue;
  }

  console.log(`Seeding "${household.name}" (${household.id})...`);
  const rows = [];

  const { data: onHandRows } = await supabase
    .from("pantry_on_hand")
    .select("ingredient_name, quantity_value, quantity_unit")
    .eq("household_id", household.id);
  const onHandByName = new Map((onHandRows ?? []).map((r) => [r.ingredient_name, r]));

  for (const cat of CORE_PANTRY) {
    for (const item of cat.items) {
      const { name, qty, unit } = parseBakedInQty(item);
      const category = CORE_CATEGORY_MAP[cat.category] ?? (await categorize(name));
      const onHand = onHandByName.get(name.trim().toLowerCase());
      rows.push({
        household_id: household.id,
        name,
        category,
        item_type: "core",
        target_qty: qty,
        target_unit: unit,
        on_hand_qty: onHand?.quantity_value ?? null,
        on_hand_unit: onHand?.quantity_unit ?? null,
      });
    }
  }

  for (const item of WEEKLY_FRESH) {
    const { name, qty, unit } = parseBakedInQty(item.label);
    const category = await categorize(name);
    rows.push({
      household_id: household.id,
      name,
      category,
      item_type: "weekly_fresh",
      target_qty: qty,
      target_unit: unit,
      on_hand_qty: null,
      on_hand_unit: null,
      note: item.note || null,
    });
  }

  const { data: staples } = await supabase
    .from("pantry_staples")
    .select("label, quantity")
    .eq("household_id", household.id);
  for (const staple of staples ?? []) {
    const { name, qty, unit } = parseBakedInQty(staple.label);
    const category = await categorize(name);
    rows.push({
      household_id: household.id,
      name,
      category,
      item_type: "staple",
      target_qty: qty,
      target_unit: unit,
      on_hand_qty: null,
      on_hand_unit: null,
    });
  }

  if (rows.length === 0) continue;
  const { error: insertError } = await supabase.from("pantry_items").insert(rows);
  if (insertError) {
    console.error(`  Failed to insert for ${household.id}:`, insertError.message);
    continue;
  }
  totalInserted += rows.length;
  console.log(`  Inserted ${rows.length} pantry_items rows.`);
}

console.log(`Done. ${totalInserted} pantry_items rows inserted across ${households.length} household(s).`);
