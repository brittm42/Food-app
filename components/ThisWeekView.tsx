"use client";

import { useMemo, useTransition } from "react";
import type { Recipe } from "@/lib/types";
import { MEAL_TYPES, mealTypeForCategory } from "@/lib/types";
import { removeFromThisWeek, clearThisWeek } from "@/app/actions/week-queue";

type Item = { queueId: string; recipe: Recipe };

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
                  <div
                    key={item.queueId}
                    className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3"
                  >
                    <span className="text-lg flex-shrink-0">{item.recipe.emoji}</span>
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">
                      {item.recipe.name}
                    </span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemove(item.queueId)}
                      aria-label="Remove from This Week"
                      className="text-ink-light hover:text-coral cursor-pointer text-sm flex-shrink-0 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
