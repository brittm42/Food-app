"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildDraftRecipeTool } from "@/lib/recipe-draft-tool";
import { createCuisineColor, type RecipeInput } from "@/app/actions/recipes";
import { autoColorForName, canonicalCuisineName } from "@/lib/types";
import { parseNumericQuantity } from "@/lib/units";
import { COMMON_INGREDIENT_NAMES } from "@/lib/common-ingredients";
import {
  findRecipeJsonLd,
  mapSchemaOrgRecipe,
  extractVisibleText,
  type ExtractedRecipe,
} from "@/lib/schema-org-recipe";

const FETCH_TIMEOUT_MS = 10_000;
// A generic modern-browser UA — some sites reject requests with no/unknown
// User-Agent outright, independent of any deeper bot-detection they run.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

const EXTRACTION_SYSTEM_PROMPT = `You are extracting a real recipe from web content into WeeklyNom's recipe library shape. Unlike drafting a brand-new recipe, faithfulness to the source matters most here:
- Never invent ingredients, quantities, or steps that aren't in the source, and never drop or merge an ingredient line the source lists — every distinct ingredient mentioned must appear exactly once. If a detail is genuinely missing (e.g. no stated quantity for an ingredient), use sparing common-sense judgment (e.g. "to taste") rather than fabricating specifics.
- If the source already states prep time, cook time, servings, or cuisine, use those values as given — only estimate prep_time_minutes/cook_time_minutes yourself when the source doesn't state them at all.
- Steps: preserve the source's actual instructions, just reformatted into one clear action per step (light inline <strong> for emphasis is OK, no other markup). Don't add flourish or invent a casual voice — this is someone else's recipe being imported as-is, not a fresh draft.
- Ingredients: split each source ingredient line into name/quantity/unit, keeping the actual ingredient the source states — write "flour", not "Waffle mix"; "milk", not "Oat milk" — even if a differently-labeled item already exists in the library. Only reuse an existing library name when it is genuinely the exact same ingredient the source means, just written differently (e.g. source says "AP flour" and the library already has "All-purpose flour" for that same thing) — never swap in an existing library ingredient just because it's in the same general category as something in the source, and never drop a real product-type distinction just to match an existing, more generic library entry (source says "shredded cheddar," library only has generic "Shredded cheese" — keep "Shredded cheddar cheese", don't collapse into the existing generic one). Getting the reused name wrong, or losing a real distinction to fit an existing name, is worse than a harmless near-duplicate, since either way it silently changes what the recipe actually calls for.
  Only strip what's genuinely brand or the cook's own transient prep action — never a distinction that changes which product someone buys, and never keep a brand just because a real distinction sits next to it in the same line. "Bob's Red Mill flour" -> "Flour" (brand). "Onion, diced" -> "Onion" (you buy a whole onion and dice it yourself). "Diamond Crystal kosher salt" -> "Kosher salt": drop "Diamond Crystal" (that's the brand), keep "kosher" (that's the actual product type — kosher and table salt aren't interchangeable by volume, so this is not optional the way the brand is). Treat brand-stripping and type-preserving as two independent edits on the same line, not an all-or-nothing choice — the correct output here is "Kosher salt", not "Salt" and not "Diamond Crystal kosher salt". Same logic as "diced tomatoes" (a specific canned product) staying "Diced tomatoes" rather than becoming plain "Tomatoes". When in doubt, ask: would a shopper buying the literal product name given actually get the right thing? If stripping a word would send them to the wrong shelf, keep it; if a word is only there to tell them which company made it, drop it.
  Bare nouns only, no quantity in the name itself. Also assign core (shelf-stable pantry item) vs fresh, and a grocery-aisle category per ingredient, same as any other recipe in this library.
  Quantity and unit are always separate fields, even when the source jams them together with no space — a line like "800g chickpeas" or "5cm ginger" is quantity "800"/unit "g" and quantity "5"/unit "cm", never quantity "800g" with a made-up unit like "canned" or "piece". If the source gives a dual measurement ("800g/1lb 12oz"), use the first one given and its real unit, don't merge both into the quantity text.
- Pick the single best-fit internal category (meal type/sub-category), zero or more dietary styles the recipe genuinely satisfies as written, and zero or more existing tags that fit — same judgment calls as regular recipe drafting.
- If given raw page text instead of already-structured data, first find the actual recipe within it — ignore site navigation, ads, comments, related-article links, and anything else that isn't the recipe itself.
- Cuisine: if the dish is a clear, well-known example of a cuisine that isn't already in the given list, name it — don't fall back to a broader or adjacent existing category just because one happens to be available. A Moroccan tagine is Moroccan, not "Middle Eastern"; a Cajun jambalaya is Cajun, not generically "American" — reaching for the nearest existing bucket when a more specific, well-known cuisine name is obviously correct is exactly the same mistake as reusing the wrong ingredient name, and it's just as wrong even though a cuisine label feels lower-stakes. Leave cuisines empty only when the dish genuinely doesn't fit any real cuisine tradition, never as a way to avoid picking between "introduce something new" and "settle for an approximate existing match."
If the given content does not actually contain a real recipe (no real ingredients and instructions to extract — e.g. it's an unrelated article, navigation/boilerplate text, or a page that failed to load meaningfully), do NOT call the draft_recipe tool. Instead, reply in plain text briefly explaining that no recipe was found.
Otherwise, always call the draft_recipe tool with your answer. Never include a change_summary — this isn't a revision of a prior draft.`;

export type ImportResult = { recipe?: RecipeInput; error?: string; needsManualText?: boolean };

export async function importRecipeFromUrl(url: string): Promise<ImportResult> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Only http/https links are supported." };
  }

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        error: `That page returned an error (${res.status}) — it may be blocking automated requests.`,
        needsManualText: true,
      };
    }
    html = await res.text();
  } catch {
    return {
      error: "Couldn't reach that page — it may be blocking automated requests.",
      needsManualText: true,
    };
  }

  const jsonLd = findRecipeJsonLd(html);
  if (jsonLd) {
    return runExtraction({ structured: mapSchemaOrgRecipe(jsonLd) }, parsed.toString());
  }

  const visibleText = extractVisibleText(html);
  if (!visibleText) {
    return { error: "Couldn't read that page's content.", needsManualText: true };
  }
  return runExtraction({ rawText: visibleText }, parsed.toString());
}

export async function importRecipeFromText(text: string, source?: string): Promise<ImportResult> {
  if (!text.trim()) return { error: "Paste the recipe text first." };
  return runExtraction({ rawText: text }, source ?? null);
}

async function runExtraction(
  input: { structured: ExtractedRecipe } | { rawText: string },
  source: string | null
): Promise<ImportResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI extraction isn't configured (missing ANTHROPIC_API_KEY)." };

  const supabase = await createClient();
  const [{ data: tagColors }, { data: cuisineColors }, { data: recipes }] = await Promise.all([
    supabase.from("tag_colors").select("name"),
    supabase.from("cuisine_colors").select("name"),
    supabase.from("recipes").select("ingredients"),
  ]);

  const tagNames = (tagColors ?? []).map((t) => t.name as string);
  const knownCuisineNames = (cuisineColors ?? []).map((c) => c.name as string);
  // Curated common-ingredient baseline first, then whatever's actually in
  // the library — see the matching comment in generate-recipe.ts.
  const knownIngredientNames = [
    ...new Set([
      ...COMMON_INGREDIENT_NAMES,
      ...(recipes ?? []).flatMap(
        (r) => ((r.ingredients as { name: string }[] | null) ?? []).map((i) => i.name)
      ),
    ]),
  ].sort();

  const userContent =
    "structured" in input
      ? `Structured recipe data extracted from a web page's schema.org markup:\n${JSON.stringify(
          input.structured,
          null,
          2
        )}${source ? `\n\nSource URL: ${source}` : ""}`
      : `Raw page text (may include unrelated site content — find the actual recipe within it):\n${input.rawText}${
          source ? `\n\nSource URL: ${source}` : ""
        }`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [buildDraftRecipeTool(tagNames, knownIngredientNames, knownCuisineNames)],
      // Deliberately not forced (unlike generate-recipe.ts's mood-based
      // drafting) — a forced tool call has no way to say "there's no recipe
      // here," which live-verification confirmed leads to a fabricated or
      // empty/placeholder draft on garbage input instead of a clean error.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      const textBlock = message.content.find((block) => block.type === "text");
      const modelMessage = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
      return {
        error: modelMessage || "Couldn't find a recipe there.",
        needsManualText: true,
      };
    }

    // change_summary is part of the shared tool schema (used when revising an
    // AI draft) but meaningless for an import — drop it so it never reaches
    // the recipes table insert as a stray, unrecognized column.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { change_summary, ...recipe } = toolUse.input as RecipeInput & {
      change_summary?: string;
    };
    recipe.ingredients = (recipe.ingredients ?? []).map((ing) => {
      const parsed = parseNumericQuantity(ing.quantity, ing.unit);
      return { ...ing, quantity_value: parsed?.value ?? null, quantity_unit: parsed?.unit ?? null };
    });
    recipe.source = source ?? recipe.source ?? null;
    recipe.imported_via = "link";
    recipe.is_ai_generated = false;

    // Normalize casing against the known vocabulary first ("italian" ->
    // "Italian" if that already exists) so a harmless casing difference
    // from the model never reads as a genuinely new cuisine.
    recipe.cuisines = (recipe.cuisines ?? []).map((c) => canonicalCuisineName(c, knownCuisineNames));

    // Same safety net as RecipeForm's manual "add new cuisine" flow — a
    // cuisine the extraction introduces should be immediately pickable
    // elsewhere, not just saved onto this one recipe.
    const newCuisines = recipe.cuisines.filter((c) => !knownCuisineNames.includes(c));
    await Promise.all(newCuisines.map((name) => createCuisineColor(name, autoColorForName(name))));

    return { recipe };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Recipe extraction failed." };
  }
}
