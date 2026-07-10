// Scales a free-text ingredient quantity ("1", "1/2", "2-3", "handful",
// "to taste") by a ratio, returning a new display string. Quantities that
// aren't confidently numeric are left unchanged — there's no sensible way
// to scale "to taste", and guessing would be worse than leaving it as-is.

const NICE_DENOMINATORS = [1, 2, 3, 4, 8];

function parseSimpleNumber(token: string): number | null {
  const trimmed = token.trim();
  if (/^\d+\/\d+$/.test(trimmed)) {
    const [n, d] = trimmed.split("/").map(Number);
    return d === 0 ? null : n / d;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  return null;
}

// Exported for lib/units.ts, which needs the same "1", "1/2", "2 1/2"
// parsing logic to turn a free-text quantity into a canonical number for
// pantry reconciliation.
export function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  const mixed = trimmed.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixed) {
    const whole = parseSimpleNumber(mixed[1]);
    const frac = parseSimpleNumber(mixed[2]);
    if (whole != null && frac != null) return whole + frac;
    return null;
  }
  return parseSimpleNumber(trimmed);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatNumber(value: number): string {
  if (value <= 0) return "0";
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.02) return String(whole || 1);
  if (frac > 0.98) return String(whole + 1);

  let best = { num: 1, den: 1, diff: Infinity };
  for (const den of NICE_DENOMINATORS) {
    const num = Math.round(frac * den);
    if (num === 0 || num === den) continue;
    const diff = Math.abs(frac - num / den);
    if (diff < best.diff) best = { num, den, diff };
  }
  const g = gcd(best.num, best.den);
  const fracStr = `${best.num / g}/${best.den / g}`;
  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

export function scaleQuantity(raw: string | null, ratio: number): string | null {
  if (!raw || ratio === 1) return raw;

  const rangeMatch = raw.trim().match(/^(.+?)\s*-\s*(.+)$/);
  if (rangeMatch) {
    const [, a, b] = rangeMatch;
    const na = parseQuantity(a);
    const nb = parseQuantity(b);
    if (na != null && nb != null) return `${formatNumber(na * ratio)}-${formatNumber(nb * ratio)}`;
    return raw;
  }

  const n = parseQuantity(raw);
  if (n == null) return raw; // "to taste", "handful", etc. — leave unchanged
  return formatNumber(n * ratio);
}
