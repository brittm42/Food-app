"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import type { RecipeWithRating, TagColor, RatingValue, Allergy } from "@/lib/types";
import { CUISINE_LABELS, TAG_COLOR_CLASSES } from "@/lib/types";
import { setRating } from "@/app/actions/ratings";
import { toggleThisWeek } from "@/app/actions/week-queue";
import { deleteRecipe } from "@/app/actions/recipes";
import RecipeStepsAndIngredients from "@/components/RecipeStepsAndIngredients";
import RecipeAllergenBadge from "@/components/RecipeAllergenBadge";

const CUISINE_BADGE_CLASSES: Record<string, string> = {
  med: "bg-cuisine-med-light text-cuisine-med",
  mex: "bg-cuisine-mex-light text-cuisine-mex",
  asi: "bg-cuisine-asi-light text-cuisine-asi",
  ind: "bg-cuisine-ind-light text-cuisine-ind",
  // Newer cuisines reuse the existing generic tag palette instead of
  // adding bespoke design tokens for each one.
  ita: TAG_COLOR_CLASSES.gold,
  tha: TAG_COLOR_CLASSES.coral,
  chn: TAG_COLOR_CLASSES.red,
  jpn: TAG_COLOR_CLASSES.plum,
  kor: TAG_COLOR_CLASSES.sage,
  viet: TAG_COLOR_CLASSES.teal,
  mideast: TAG_COLOR_CLASSES.gold,
  gre: TAG_COLOR_CLASSES.teal,
  fre: TAG_COLOR_CLASSES.plum,
  amr: TAG_COLOR_CLASSES.coral,
};

export default function RecipeCard({
  recipe,
  tagColors,
  householdAllergies,
}: {
  recipe: RecipeWithRating;
  tagColors: TagColor[];
  householdAllergies: Allergy[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasMacros = Boolean(
    recipe.protein || recipe.fiber || recipe.cal || recipe.prep_time_minutes
  );
  const tagColorByName = Object.fromEntries(tagColors.map((t) => [t.name, t.color]));

  function rate(value: RatingValue) {
    startTransition(() => {
      setRating(recipe.id, value);
    });
  }

  function queue() {
    startTransition(() => {
      toggleThisWeek(recipe.id);
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
              {recipe.is_ai_generated && (
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-plum-light text-plum">
                  ✨ AI
                </span>
              )}
              <RecipeAllergenBadge
                ingredients={recipe.ingredients}
                householdAllergies={householdAllergies}
              />
              {recipe.cuisines.map(
                (cuisine) =>
                  CUISINE_LABELS[cuisine] && (
                    <span
                      key={cuisine}
                      className={`font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${CUISINE_BADGE_CLASSES[cuisine]}`}
                    >
                      {CUISINE_LABELS[cuisine]}
                    </span>
                  )
              )}
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                    TAG_COLOR_CLASSES[tagColorByName[tag]] ?? "bg-sage-light text-sage"
                  }`}
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
              onClick={queue}
              aria-label={recipe.queued ? "Remove from This Week" : "Add to This Week"}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] cursor-pointer transition-colors disabled:opacity-50 ${
                recipe.queued
                  ? "bg-gold text-white"
                  : "bg-surface-warm text-ink-light hover:bg-gold-light"
              }`}
            >
              📅
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
          <div className="flex gap-1.5 mb-3.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => rate("up")}
              aria-label="Mark as favorite"
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors disabled:opacity-50 ${
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
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors disabled:opacity-50 ${
                recipe.rating === "down"
                  ? "bg-coral text-white"
                  : "bg-surface-warm text-ink-light hover:bg-coral-light"
              }`}
            >
              👎
            </button>
            {recipe.editable && (
              <>
                <Link
                  href={`/recipes/${recipe.id}/edit`}
                  aria-label="Edit recipe"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors bg-surface-warm text-ink-light hover:bg-sage-light"
                >
                  ✏️
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
                    startTransition(() => {
                      deleteRecipe(recipe.id);
                    });
                  }}
                  aria-label="Delete recipe"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors disabled:opacity-50 bg-surface-warm text-ink-light hover:bg-red-light"
                >
                  🗑️
                </button>
              </>
            )}
          </div>
          <RecipeStepsAndIngredients
            steps={recipe.steps}
            legacyRecipe={recipe.recipe}
            ingredients={recipe.ingredients}
          />
          {hasMacros && (
            <div className="flex gap-2 mt-3.5">
              {recipe.prep_time_minutes ? (
                <Macro value={`${recipe.prep_time_minutes}m`} label="Prep" />
              ) : null}
              {recipe.protein ? (
                <Macro value={`${recipe.protein}g`} label="Protein" />
              ) : null}
              {recipe.fiber ? (
                <Macro value={`${recipe.fiber}g`} label="Fiber" />
              ) : null}
              {recipe.cal ? <Macro value={`${recipe.cal}`} label="Cal" /> : null}
            </div>
          )}
          {recipe.source && (
            <a
              href={recipe.source}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-xs text-teal underline truncate"
            >
              Source ↗
            </a>
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
