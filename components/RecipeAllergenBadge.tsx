import { flagAllergensInRecipe } from "@/lib/allergens";
import type { Allergy, Ingredient } from "@/lib/types";

const BADGE_CLASSES: Record<Allergy["handling"], string> = {
  strict_avoidance: "bg-red-light text-red",
  substitution_ok: "bg-gold-light text-gold",
  just_flag: "bg-sage-light text-sage",
};

export default function RecipeAllergenBadge({
  ingredients,
  householdAllergies,
}: {
  ingredients: Ingredient[] | null;
  householdAllergies: Allergy[];
}) {
  const flags = flagAllergensInRecipe(ingredients, householdAllergies);
  if (!flags.length) return null;

  return (
    <>
      {flags.map((f) => (
        <span
          key={f.name}
          className={`font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${BADGE_CLASSES[f.handling]}`}
        >
          ⚠️ Contains {f.name}
        </span>
      ))}
    </>
  );
}
