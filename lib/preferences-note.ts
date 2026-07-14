// Pure helpers shared by app/actions/generate-recipe.ts's AI-drafting flow
// and app/actions/onboarding.ts's curation flow. Kept out of
// generate-recipe.ts itself because that file is "use server" — every
// export from a "use server" module must be an async function, and
// buildPreferencesNote is a plain sync function.
import type { Allergy, AllergyHandling } from "@/lib/types";
import { DIETARY_STYLES, HEALTH_GOALS } from "@/lib/types";

export type PersonPrefs = {
  displayName: string | null;
  allergies: Allergy[];
  avoidFoods: string[];
  cuisinePreferences: string[];
  dietaryStyle: string[];
  healthGoals: string[];
};

export type HouseholdPreferencesContext = {
  people: PersonPrefs[];
  weeknightTimeMinutes: number | null;
  skillLevel: string | null;
  mealPriorities: string[];
};

// Prompt-facing clarifications for dietary styles, kept local to this file
// (not lib/types.ts) since these sentences are AI-prompt engineering, not a
// UI concern — lib/types.ts's DIETARY_STYLES stays a plain id->label map
// for the chip UI.
const DIETARY_STYLE_NOTES: Record<string, string> = {
  vegetarian: "no meat or fish",
  vegan: "no meat, fish, dairy, eggs, or other animal products",
  pescatarian: "fish is fine, no other meat",
  gluten_free: "no wheat, barley, rye, or other gluten-containing ingredients",
  dairy_free: "no milk, cheese, butter, or other dairy",
  keto: "very low-carb, high-fat",
  low_carb: "keep carbs modest",
  paleo: "no grains, legumes, or refined sugar",
  kosher: "kosher dietary rules",
  halal: "halal dietary rules",
};

const HANDLING_PHRASING: Record<AllergyHandling, (name: string) => string> = {
  strict_avoidance: (n) => `a hard constraint — never include ${n} under any circumstance`,
  substitution_ok: (n) =>
    `avoid ${n} where possible, but a substitution is OK — just mention the swap if you make one`,
  just_flag: (n) => `${n} may be included — just clearly note that it's present`,
};

export function buildPreferencesNote(ctx: HouseholdPreferencesContext | null): string {
  if (!ctx || !ctx.people.length) return "";
  const lines: string[] = [];

  for (const person of ctx.people) {
    const who = person.displayName?.trim() || "A household member";
    if (person.allergies.length) {
      const parts = person.allergies.map(
        (a) => `${a.name} (${a.severity} allergy — ${HANDLING_PHRASING[a.handling](a.name)})`
      );
      lines.push(`${who}'s allergies: ${parts.join("; ")}.`);
    }
    if (person.avoidFoods.length) {
      lines.push(`${who} would rather avoid (a dislike, not an allergy): ${person.avoidFoods.join(", ")}.`);
    }
    if (person.dietaryStyle.length) {
      const styles = person.dietaryStyle
        .map((s) => `${DIETARY_STYLES[s] ?? s}${DIETARY_STYLE_NOTES[s] ? ` (${DIETARY_STYLE_NOTES[s]})` : ""}`)
        .join(", ");
      lines.push(`${who} eats ${styles}.`);
    }
    if (person.healthGoals.length) {
      lines.push(`${who}'s goals: ${person.healthGoals.map((g) => HEALTH_GOALS[g] ?? g).join(", ")}.`);
    }
    if (person.cuisinePreferences.length) {
      lines.push(`${who} especially enjoys these cuisines: ${person.cuisinePreferences.join(", ")}.`);
    }
  }

  if (ctx.weeknightTimeMinutes) {
    lines.push(
      `This household generally has about ${ctx.weeknightTimeMinutes} minutes for weeknight cooking — favor recipes that fit that unless told otherwise.`
    );
  }
  if (ctx.skillLevel) {
    lines.push(`Cook's skill level: ${ctx.skillLevel}.`);
  }
  if (ctx.mealPriorities.length) {
    lines.push(`Meals that matter most to this household: ${ctx.mealPriorities.join(", ")}.`);
  }

  if (!lines.length) return "";
  return (
    `\n\nHousehold context — this always applies, regardless of who is chatting with you right now ` +
    `(allergy constraints protect every household member, not just the current speaker):\n${lines.join(" ")}`
  );
}
