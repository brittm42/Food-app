"use client";

import { useTransition, useState } from "react";
import type { RecipeWithRating, RatingValue } from "@/lib/types";
import { CUISINE_LABELS } from "@/lib/types";
import { setRating } from "@/app/actions/ratings";

const CUISINE_BADGE_CLASSES: Record<string, string> = {
  med: "bg-cuisine-med-light text-cuisine-med",
  mex: "bg-cuisine-mex-light text-cuisine-mex",
  asi: "bg-cuisine-asi-light text-cuisine-asi",
  ind: "bg-cuisine-ind-light text-cuisine-ind",
};

const TAG_CLASSES: Record<string, string> = {
  "High protein": "bg-teal-light text-teal",
  "High fiber": "bg-teal-light text-teal",
  "No-cook": "bg-gold-light text-gold",
  "Batch cook": "bg-plum-light text-plum",
  "Britt only": "bg-coral-light text-coral",
};

export default function RecipeCard({ recipe }: { recipe: RecipeWithRating }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasMacros = Boolean(recipe.protein || recipe.fiber || recipe.cal);

  function rate(value: RatingValue) {
    startTransition(() => {
      setRating(recipe.id, value);
    });
  }

  return (
    <div
      className={`bg-surface border border-border rounded-[14px] overflow-hidden transition-opacity ${
        recipe.rating === "down" ? "opacity-55" : ""
      }`}
    >
      <div className="w-full flex items-start gap-3 p-3.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-start gap-3 text-left cursor-pointer min-w-0"
        >
          <div className="w-[38px] h-[38px] rounded-[10px] bg-surface-warm flex items-center justify-center text-lg flex-shrink-0">
            {recipe.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight mb-0.5">
              {recipe.rating === "up" && <span aria-hidden>⭐ </span>}
              {recipe.name}
            </div>
            {recipe.hint && (
              <div className="text-xs text-ink-light">{recipe.hint}</div>
            )}
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {recipe.cuisine && CUISINE_LABELS[recipe.cuisine] && (
                <span
                  className={`font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${CUISINE_BADGE_CLASSES[recipe.cuisine]}`}
                >
                  {CUISINE_LABELS[recipe.cuisine]}
                </span>
              )}
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${TAG_CLASSES[tag] ?? "bg-sage-light text-sage"}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex gap-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => rate("up")}
              aria-label="Mark as favorite"
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] cursor-pointer transition-colors disabled:opacity-50 ${
                recipe.rating === "up"
                  ? "bg-teal text-white"
                  : "bg-surface-warm text-ink-light hover:bg-teal-light"
              }`}
            >
              👍
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => rate("down")}
              aria-label="Mark as not for me"
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] cursor-pointer transition-colors disabled:opacity-50 ${
                recipe.rating === "down"
                  ? "bg-coral text-white"
                  : "bg-surface-warm text-ink-light hover:bg-coral-light"
              }`}
            >
              👎
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse recipe" : "Expand recipe"}
            className={`text-[11px] text-ink-light transition-transform cursor-pointer ${open ? "rotate-180" : ""}`}
          >
            ▼
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border px-3.5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-1.5">
            How to make it
          </div>
          <div
            className="text-[13.5px] leading-relaxed [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: recipe.recipe }}
          />
          {hasMacros && (
            <div className="flex gap-2 mt-3.5">
              {recipe.protein ? (
                <Macro value={`${recipe.protein}g`} label="Protein" />
              ) : null}
              {recipe.fiber ? (
                <Macro value={`${recipe.fiber}g`} label="Fiber" />
              ) : null}
              {recipe.cal ? <Macro value={`${recipe.cal}`} label="Cal" /> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Macro({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 bg-surface-warm rounded-lg py-2 text-center">
      <div className="font-display text-base text-teal leading-none">
        {value}
      </div>
      <div className="font-mono text-[10px] text-ink-light mt-1">{label}</div>
    </div>
  );
}
