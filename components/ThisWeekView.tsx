"use client";

import { useMemo, useState, useTransition } from "react";
import type { Recipe } from "@/lib/types";
import { MEAL_TYPES, mealTypeForCategory } from "@/lib/types";
import { removeFromThisWeek, clearThisWeek, setServingsOverride } from "@/app/actions/week-queue";
import { scaleQuantity } from "@/lib/scale-quantity";
import RecipeStepsAndIngredients from "@/components/RecipeStepsAndIngredients";

type Item = { queueId: string; servingsOverride: number | null; recipe: Recipe };

export default function ThisWeekView({ items }: { items: Item[] }) {
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of items) {
      const mealType = mealTypeForCategory(item.recipe.category);
      (map[mealType] ??= []).push(item);
    }
    return map;
  }, [items]);

  function handleRemove(queueId: string) {
    startTransition(() => {
      removeFromThisWeek(queueId);
    });
  }

  function handleClear() {
    if (!window.confirm("Clear all meals from This Week?")) return;
    startTransition(() => {
      clearThisWeek();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-xl font-light">This Week</h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="font-mono text-[10px] uppercase tracking-wide text-coral hover:underline cursor-pointer disabled:opacity-50"
          >
            Clear this week
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center text-ink-light text-sm py-10">
          Nothing queued yet — tap 📅 on a recipe to add it here.
        </div>
      ) : (
        MEAL_TYPES.map((meal) => {
          const mealItems = grouped[meal.id];
          if (!mealItems?.length) return null;
          return (
            <section key={meal.id} className="mb-6">
              <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
                {meal.label}
              </h2>
              <div className="flex flex-col gap-2">
                {mealItems.map((item) => (
                  <ThisWeekRow
                    key={item.queueId}
                    item={item}
                    onRemove={handleRemove}
                    removeDisabled={isPending}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ThisWeekRow({
  item,
  onRemove,
  removeDisabled,
}: {
  item: Item;
  onRemove: (queueId: string) => void;
  removeDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const baseServings = item.recipe.servings ?? 1;
  const [servings, setServings] = useState(item.servingsOverride ?? baseServings);
  const [isPending, startTransition] = useTransition();

  function adjustServings(delta: number) {
    const next = Math.max(1, Math.min(24, servings + delta));
    if (next === servings) return;
    setServings(next);
    startTransition(() => {
      setServingsOverride(item.queueId, next);
    });
  }

  const ratio = servings / baseServings;
  const scaledIngredients = useMemo(
    () =>
      (item.recipe.ingredients ?? []).map((ing) => ({
        ...ing,
        quantity: scaleQuantity(ing.quantity, ratio),
      })),
    [item.recipe.ingredients, ratio]
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left"
        >
          <span className="text-lg flex-shrink-0">{item.recipe.emoji}</span>
          <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.recipe.name}</span>
        </button>
        <button
          type="button"
          disabled={removeDisabled}
          onClick={() => onRemove(item.queueId)}
          aria-label="Remove from This Week"
          className="text-ink-light hover:text-coral cursor-pointer text-sm flex-shrink-0 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
              Serves
            </span>
            <button
              type="button"
              disabled={isPending || servings <= 1}
              onClick={() => adjustServings(-1)}
              aria-label="Decrease servings"
              className="w-6 h-6 rounded-full bg-surface-warm text-ink-light hover:bg-gold-light flex items-center justify-center text-sm leading-none cursor-pointer disabled:opacity-40"
            >
              −
            </button>
            <span className="font-display text-sm w-5 text-center">{servings}</span>
            <button
              type="button"
              disabled={isPending || servings >= 24}
              onClick={() => adjustServings(1)}
              aria-label="Increase servings"
              className="w-6 h-6 rounded-full bg-surface-warm text-ink-light hover:bg-gold-light flex items-center justify-center text-sm leading-none cursor-pointer disabled:opacity-40"
            >
              +
            </button>
            {servings !== baseServings && (
              <span className="text-xs text-ink-light">(recipe default: {baseServings})</span>
            )}
          </div>
          <RecipeStepsAndIngredients
            steps={item.recipe.steps}
            legacyRecipe={item.recipe.recipe}
            ingredients={scaledIngredients}
          />
        </div>
      )}
    </div>
  );
}
