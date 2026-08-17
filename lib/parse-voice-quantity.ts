// Extracts an explicit quantity/unit from a voice quick-add utterance
// ("2 bags of Tostitos bites") so it lands in shopping_items as a real
// quantity_value/quantity_unit instead of raw text baked into the label.
// Pattern-matches the common "N unit of X" shape first (free, instant);
// only falls back to a constrained Claude tool call when a quantity word is
// present but the pattern can't confidently resolve a unit (e.g. "3
// apples", where "apples" isn't a purchase unit). No quantity signal at all
// (e.g. "milk") skips both and returns the raw text as the label unchanged
// — same zero-cost behavior as before this fix.
import Anthropic from "@anthropic-ai/sdk";
import { canonicalizeUnit, UNIT_OPTIONS } from "@/lib/units";

export type ParsedVoiceQuantity = {
  label: string;
  quantityValue: number | null;
  quantityUnit: string | null;
};

// "a"/"an" are only trusted as a quantity when patternMatch's stricter
// unit-must-canonicalize check succeeds (e.g. "a dozen eggs") — they're too
// common as ordinary articles (e.g. "A1 Steak Sauce") to safely trigger the
// AI fallback on their own.
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
};

const AI_TRIGGER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "dozen",
  "couple",
  "few",
  "several",
];
const QUANTITY_SIGNAL = new RegExp(`^(?:\\d|${AI_TRIGGER_WORDS.join("|")})\\b`, "i");

function parseQtyToken(token: string): number | null {
  if (/^\d+\/\d+$/.test(token)) {
    const [num, den] = token.split("/").map(Number);
    return den ? num / den : null;
  }
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}

// Matches "2 bags of Tostitos bites", "a dozen eggs", "1/2 lb ground beef"
// — a leading quantity token, a recognized unit word, optional "of", then
// the item name. Anything else (no leading quantity, or an unrecognized
// unit like "3 apples") isn't confidently parseable here.
function patternMatch(raw: string): ParsedVoiceQuantity | null {
  const match = raw.match(/^(\d+(?:\.\d+)?|\d+\/\d+|[a-z]+)\s+([a-z]+)\.?\s*(?:of\s+)?(.+)$/i);
  if (!match) return null;
  const [, qtyToken, unitToken, rest] = match;
  const label = rest.trim();
  if (!label) return null;

  const value = parseQtyToken(qtyToken);
  if (value == null) return null;

  const unit = canonicalizeUnit(unitToken);
  if (!unit) return null;

  return { label, quantityValue: value, quantityUnit: unit };
}

function buildTool(): Anthropic.Tool {
  return {
    name: "parse_quantity",
    description:
      "Split a spoken shopping-list item into its quantity, unit, and item name. Only set quantity_unit if it clearly matches one of the allowed units; omit it otherwise rather than guessing a close-but-wrong unit.",
    input_schema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "The item name with any quantity/unit words removed, e.g. 'Tostitos bites'.",
        },
        quantity_value: {
          type: "number",
          description: "The numeric quantity, if one was spoken (e.g. 'a couple' -> 2).",
        },
        quantity_unit: {
          type: "string",
          enum: UNIT_OPTIONS.map((u) => u.value),
          description: "The unit, only if it clearly matches one of these exact values.",
        },
      },
      required: ["label"],
    },
  };
}

// Fails open to "no quantity, raw text as label" on any parsing miss — same
// philosophy as lib/categorize.ts's categorizeItem.
async function aiParse(raw: string): Promise<ParsedVoiceQuantity> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { label: raw, quantityValue: null, quantityUnit: null };

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 128,
      tools: [buildTool()],
      tool_choice: { type: "tool", name: "parse_quantity" },
      messages: [{ role: "user", content: raw }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { label: raw, quantityValue: null, quantityUnit: null };
    }

    const input = toolUse.input as { label?: string; quantity_value?: number; quantity_unit?: string };
    const label = typeof input.label === "string" && input.label.trim() ? input.label.trim() : raw;
    const quantityValue = typeof input.quantity_value === "number" ? input.quantity_value : null;
    const quantityUnit = quantityValue != null ? canonicalizeUnit(input.quantity_unit) : null;

    return { label, quantityValue, quantityUnit };
  } catch {
    return { label: raw, quantityValue: null, quantityUnit: null };
  }
}

export async function parseVoiceItemQuantity(raw: string): Promise<ParsedVoiceQuantity> {
  const trimmed = raw.trim();

  const matched = patternMatch(trimmed);
  if (matched) return matched;

  if (!QUANTITY_SIGNAL.test(trimmed)) {
    return { label: trimmed, quantityValue: null, quantityUnit: null };
  }

  return aiParse(trimmed);
}
