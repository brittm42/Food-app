import * as cheerio from "cheerio";

// Raw material pulled from a page's schema.org Recipe JSON-LD — still
// natural-language (ingredient lines, instruction text), not yet mapped
// into WeeklyNom's structured Ingredient[]/steps[] shape. That mapping
// (name/quantity/unit split, category/tags/dietary_style classification)
// is an AI extraction pass, same as AI-drafted recipes, since schema.org
// has no notion of our internal taxonomy.
export type ExtractedRecipe = {
  name?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: string | null;
  cuisine: string[];
};

function parseIsoDurationMinutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const match = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  if (!hours && !minutes) return null;
  return hours * 60 + minutes;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.name === "string") return obj.name;
  }
  return undefined;
}

// HowToStep / HowToSection can nest a section's steps inside itemListElement
// — flatten to a plain ordered list of step text.
function flattenInstructions(value: unknown): string[] {
  const out: string[] = [];
  for (const item of asArray(value as unknown[])) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj["@type"] === "HowToSection" && obj.itemListElement) {
        out.push(...flattenInstructions(obj.itemListElement));
        continue;
      }
      const t = textOf(obj);
      if (t) out.push(t);
    }
  }
  return out;
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const types = asArray(obj["@type"] as string | string[] | undefined);
  if (types.includes("Recipe")) return obj;
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

// Sites sometimes emit multiple <script type="application/ld+json"> blocks
// (one per schema type on the page) — search all of them for the one that's
// actually a Recipe, tolerating malformed JSON in unrelated blocks.
export function findRecipeJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const raw = $(el).contents().text();
    if (!raw?.trim()) continue;
    try {
      const found = findRecipeNode(JSON.parse(raw));
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

export function mapSchemaOrgRecipe(node: Record<string, unknown>): ExtractedRecipe {
  const yieldValue = asArray(node.recipeYield as string | number | (string | number)[] | undefined)[0];
  return {
    name: textOf(node.name),
    description: textOf(node.description),
    ingredients: asArray(
      (node.recipeIngredient ?? node.ingredients) as string | string[] | undefined
    ).map(String),
    instructions: flattenInstructions(node.recipeInstructions),
    prepTimeMinutes: parseIsoDurationMinutes(node.prepTime),
    cookTimeMinutes: parseIsoDurationMinutes(node.cookTime),
    servings: yieldValue != null ? String(yieldValue) : null,
    cuisine: asArray(node.recipeCuisine as string | string[] | undefined).map(String),
  };
}

// Strips the noise (scripts, nav, ads chrome) a plain fetch can't avoid
// pulling in, and caps length so the fallback AI-extraction call stays a
// reasonable size regardless of how bloated the source page is. This path
// only runs when a page has no schema.org JSON-LD at all — sites that do
// (the common case) never hit this cap. The cap is generous on purpose:
// confirmed truncating a real recipe out at 15k chars, and a real,
// famously verbose/comment-heavy blog (pinchofyum.com) measured 48k chars
// of visible text on its own — comfortably under 60k but with little
// headroom to spare, so this is set well above that observed real-world
// case rather than just above the synthetic test that first caught it.
export function extractVisibleText(html: string, maxLength = 120000): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg, iframe").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.slice(0, maxLength);
}
