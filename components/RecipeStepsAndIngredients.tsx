import type { Ingredient } from "@/lib/types";

export default function RecipeStepsAndIngredients({
  steps,
  legacyRecipe,
  ingredients,
}: {
  steps: string[];
  legacyRecipe: string | null;
  ingredients: Ingredient[] | null;
}) {
  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-1.5">
        How to make it
      </div>
      {steps.length > 0 ? (
        <ol className="text-[13.5px] leading-relaxed [&_strong]:font-semibold list-decimal list-inside flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
          ))}
        </ol>
      ) : legacyRecipe ? (
        <div
          className="text-[13.5px] leading-relaxed [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: legacyRecipe }}
        />
      ) : null}
      {ingredients && ingredients.length > 0 && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-1.5 mt-3.5">
            Ingredients
          </div>
          <ul className="text-[13.5px] leading-relaxed flex flex-col gap-1">
            {ingredients.map((ing, i) => (
              <li key={i}>
                {ing.quantity && (
                  <span className="text-ink-light">
                    {ing.quantity}
                    {ing.unit ? ` ${ing.unit}` : ""}{" "}
                  </span>
                )}
                {ing.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
