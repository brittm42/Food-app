// Computed at render time from live ingredient/allergy data — never stored,
// since preferences and recipe ingredients both change over time.
// Deliberately simple (case-insensitive substring / naive singular match)
// since allergy names are free text, not a fixed taxonomy — good enough to
// flag the obvious case, not a full allergen-detection system.
import type { Allergy, AllergyHandling, Ingredient } from "@/lib/types";

export type AllergenFlag = {
  name: string;
  severity: Allergy["severity"];
  handling: AllergyHandling;
};

const HANDLING_RANK: Record<AllergyHandling, number> = {
  strict_avoidance: 0,
  substitution_ok: 1,
  just_flag: 2,
};

// When the same allergy name is entered by multiple household members with
// different handling, use the strictest one — under-flagging a real "never
// include" allergy in favor of a laxer duplicate would be unsafe.
function dedupeStrictest(allergies: Allergy[]): Allergy[] {
  const byName = new Map<string, Allergy>();
  for (const a of allergies) {
    const key = a.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing || HANDLING_RANK[a.handling] < HANDLING_RANK[existing.handling]) {
      byName.set(key, a);
    }
  }
  return [...byName.values()];
}

function singularize(word: string): string {
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}

// People naturally add caveats in parentheses (e.g. "Eggs (not including
// baked goods)" — a real entry seen in production). The caveat text will
// never literally appear in an ingredient name, so match against the core
// allergen phrase only, not the whole free-text entry.
function coreAllergenName(name: string): string {
  const withoutParens = name.replace(/\([^)]*\)/g, "").trim();
  return singularize(withoutParens.toLowerCase());
}

export function flagAllergensInRecipe(
  ingredients: Ingredient[] | null,
  householdAllergies: Allergy[]
): AllergenFlag[] {
  if (!ingredients?.length || !householdAllergies.length) return [];

  const names = ingredients.map((i) => i.name.toLowerCase());
  const flags: AllergenFlag[] = [];

  for (const allergy of dedupeStrictest(householdAllergies)) {
    const stem = coreAllergenName(allergy.name);
    if (stem && names.some((n) => n.includes(stem))) {
      flags.push({ name: allergy.name, severity: allergy.severity, handling: allergy.handling });
    }
  }

  return flags;
}
