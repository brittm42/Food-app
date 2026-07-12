import type { Ingredient } from "@/lib/types";
import { linkStepSegments } from "@/lib/step-linking";
import RecipeTimer from "@/components/RecipeTimer";

function StepText({ step, ingredients }: { step: string; ingredients: Ingredient[] }) {
  const segments = linkStepSegments(step, ingredients);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") return seg.bold ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>;
        if (seg.kind === "emphasis") return <strong key={i}>{seg.text}</strong>;
        if (seg.kind === "timer") return <RecipeTimer key={i} seconds={seg.seconds} label={seg.text} />;
        return (
          <span
            key={i}
            title={seg.amount ?? undefined}
            className="inline-flex items-baseline gap-1 bg-teal-light text-teal rounded px-1 -mx-0.5"
          >
            {seg.text}
            {seg.amount && <span className="text-[10.5px] text-teal/70">({seg.amount})</span>}
          </span>
        );
      })}
    </>
  );
}

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
        <ol className="text-[13.5px] leading-relaxed list-decimal list-inside flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <li key={i}>
              <StepText step={step} ingredients={ingredients ?? []} />
            </li>
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
