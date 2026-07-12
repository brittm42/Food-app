import type { Ingredient } from "@/lib/types";

export type StepSegment =
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "ingredient"; text: string; amount: string | null }
  | { kind: "timer"; text: string; seconds: number }
  | { kind: "emphasis"; text: string };

type Match = { start: number; end: number; segment: StepSegment };

const TIME_PATTERN =
  /\b(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
const TEMP_PATTERN = /\b\d{2,3}\s*°\s*[FC]\b/g;

function unitToSeconds(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("hour") || u.startsWith("hr")) return value * 3600;
  if (u.startsWith("min")) return value * 60;
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strips <strong> tags while recording the plain-text ranges they covered,
// so bold emphasis on phrases we don't otherwise detect (e.g. "don't boil
// after") survives rather than silently disappearing.
function stripBoldTags(html: string): { plainText: string; boldRanges: [number, number][] } {
  const boldRanges: [number, number][] = [];
  let plainText = "";
  let boldStart: number | null = null;
  let lastIndex = 0;
  const tagPattern = /<(\/?)strong>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    plainText += html.slice(lastIndex, match.index);
    if (match[1] === "") {
      boldStart = plainText.length;
    } else if (boldStart !== null) {
      boldRanges.push([boldStart, plainText.length]);
      boldStart = null;
    }
    lastIndex = tagPattern.lastIndex;
  }
  plainText += html.slice(lastIndex);
  return { plainText, boldRanges };
}

function isBold(pos: number, boldRanges: [number, number][]): boolean {
  return boldRanges.some(([start, end]) => pos >= start && pos < end);
}

function findIngredientMatches(plainText: string, ingredients: Ingredient[]): Match[] {
  const names = [...new Set(ingredients.map((i) => i.name.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  if (names.length === 0) return [];
  const byLowerName = new Map(ingredients.map((i) => [i.name.trim().toLowerCase(), i]));
  const pattern = new RegExp(`\\b(${names.map(escapeRegExp).join("|")})\\b`, "gi");
  const matches: Match[] = [];
  for (const m of plainText.matchAll(pattern)) {
    const ing = byLowerName.get(m[0].toLowerCase());
    if (!ing) continue;
    const amount = ing.quantity ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : null;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { kind: "ingredient", text: m[0], amount },
    });
  }
  return matches;
}

function findTimerMatches(plainText: string): Match[] {
  const matches: Match[] = [];
  for (const m of plainText.matchAll(TIME_PATTERN)) {
    const upper = m[2] ?? m[1];
    const seconds = unitToSeconds(Number(upper), m[3]);
    if (seconds < 10) continue; // skip noise like "1 second"
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { kind: "timer", text: m[0], seconds },
    });
  }
  return matches;
}

function findTempMatches(plainText: string): Match[] {
  const matches: Match[] = [];
  for (const m of plainText.matchAll(TEMP_PATTERN)) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { kind: "emphasis", text: m[0] },
    });
  }
  return matches;
}

function resolveOverlaps(matches: Match[]): Match[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const resolved: Match[] = [];
  let lastEnd = -1;
  for (const match of sorted) {
    if (match.start < lastEnd) continue;
    resolved.push(match);
    lastEnd = match.end;
  }
  return resolved;
}

// Splits a plain-text run into bold/non-bold text segments per boldRanges.
function textSegmentsFor(text: string, offset: number, boldRanges: [number, number][]): StepSegment[] {
  const segments: StepSegment[] = [];
  let runStart = 0;
  let runBold = isBold(offset, boldRanges);
  for (let i = 1; i <= text.length; i++) {
    const bold = i < text.length ? isBold(offset + i, boldRanges) : !runBold;
    if (bold !== runBold) {
      segments.push({ kind: "text", text: text.slice(runStart, i), bold: runBold });
      runStart = i;
      runBold = bold;
    }
  }
  if (runStart < text.length) segments.push({ kind: "text", text: text.slice(runStart), bold: runBold });
  return segments;
}

export function linkStepSegments(step: string, ingredients: Ingredient[]): StepSegment[] {
  const { plainText, boldRanges } = stripBoldTags(step);
  const matches = resolveOverlaps([
    ...findIngredientMatches(plainText, ingredients),
    ...findTimerMatches(plainText),
    ...findTempMatches(plainText),
  ]);

  const segments: StepSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      segments.push(...textSegmentsFor(plainText.slice(cursor, match.start), cursor, boldRanges));
    }
    segments.push(match.segment);
    cursor = match.end;
  }
  if (cursor < plainText.length) {
    segments.push(...textSegmentsFor(plainText.slice(cursor), cursor, boldRanges));
  }
  return segments;
}
