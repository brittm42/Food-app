"use client";

import { useMemo, useState, useTransition } from "react";
import type { RecipeWithRating, TagColor, RatingValue, MealType } from "@/lib/types";
import { MEAL_TYPES, SUB_CATEGORIES, OAT_FLAVORS, OAT_BASE } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";
import { toggleOatPick } from "@/app/actions/oat-picks";

const TAB_BASE =
  "flex-shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors";
const TAB_ACTIVE = "bg-ink text-white border-ink";
const TAB_INACTIVE = "bg-surface text-ink-light border-border hover:bg-surface-warm";

function ratingRank(rating: RatingValue | null) {
  if (rating === "up") return 0;
  if (rating === "down") return 2;
  return 1;
}

export default function RecipesBrowser({
  recipes,
  tagColors,
  pickedFlavorIds,
}: {
  recipes: RecipeWithRating[];
  tagColors: TagColor[];
  pickedFlavorIds: string[];
}) {
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const subCats = SUB_CATEGORIES[activeMeal];
  const [activeSub, setActiveSub] = useState(subCats[0].id);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [kidFriendlyOnly, setKidFriendlyOnly] = useState(false);

  function selectMeal(meal: MealType) {
    setActiveMeal(meal);
    setActiveSub(SUB_CATEGORIES[meal][0].id);
  }

  const recipesByCategory = useMemo(() => {
    const map: Record<string, RecipeWithRating[]> = {};
    for (const r of recipes) {
      (map[r.category] ??= []).push(r);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => ratingRank(a.rating) - ratingRank(b.rating));
    }
    return map;
  }, [recipes]);

  const visibleSubCats = SUB_CATEGORIES[activeMeal];
  const showOats = activeMeal === "breakfast" && activeSub === "oats";
  const showFilters = !showOats && activeMeal !== "solo";
  const visibleRecipes = (recipesByCategory[activeSub] ?? []).filter(
    (r) =>
      (!favoritesOnly || r.rating === "up") &&
      (!kidFriendlyOnly || r.tags.includes("Kid-friendly"))
  );

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto mb-5">
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal.id}
            type="button"
            onClick={() => selectMeal(meal.id)}
            className={`${TAB_BASE} ${activeMeal === meal.id ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {meal.label}
          </button>
        ))}
      </div>

      {visibleSubCats.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mb-5">
          {visibleSubCats.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setActiveSub(sub.id)}
              className={`${TAB_BASE} ${activeSub === sub.id ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="flex justify-end gap-2 mb-3">
          <button
            type="button"
            onClick={() => setKidFriendlyOnly((v) => !v)}
            className={`${TAB_BASE} ${kidFriendlyOnly ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            🧒 Kid-friendly only
          </button>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`${TAB_BASE} ${favoritesOnly ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            ⭐ Favorites only
          </button>
        </div>
      )}

      {showOats ? (
        <OatFlavorGrid pickedFlavorIds={pickedFlavorIds} />
      ) : (
        <RecipeList recipes={visibleRecipes} tagColors={tagColors} />
      )}
    </div>
  );
}

function RecipeList({
  recipes,
  tagColors,
}: {
  recipes: RecipeWithRating[];
  tagColors: TagColor[];
}) {
  if (recipes.length === 0) {
    return (
      <div className="text-center text-ink-light text-sm py-10">
        No recipes here yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} tagColors={tagColors} />
      ))}
    </div>
  );
}

function OatFlavorGrid({ pickedFlavorIds }: { pickedFlavorIds: string[] }) {
  const [isPending, startTransition] = useTransition();
  const pickedCount = pickedFlavorIds.length;

  function pick(flavorId: string) {
    startTransition(() => {
      toggleOatPick(flavorId);
    });
  }

  const counterText =
    pickedCount >= 2
      ? "Your 2 picks are ready ✓"
      : pickedCount === 1
        ? "1 of 2 picked"
        : "Pick 2 flavors for the week";

  return (
    <div>
      <div className="bg-ink text-white/85 rounded-[10px] p-4 mb-4 text-[13.5px] leading-relaxed">
        <strong className="text-teal-mid">Base (always the same):</strong>{" "}
        {OAT_BASE}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2.5">
        {counterText}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {OAT_FLAVORS.map((flavor) => {
          const isPicked = pickedFlavorIds.includes(flavor.id);
          return (
            <button
              key={flavor.id}
              type="button"
              disabled={isPending}
              onClick={() => pick(flavor.id)}
              className={`text-left bg-surface border rounded-xl p-3.5 cursor-pointer transition-colors disabled:opacity-50 ${
                isPicked ? "border-gold bg-gold-light" : "border-border"
              }`}
            >
              <div className="text-xl mb-1.5">{flavor.emoji}</div>
              <div className="font-semibold text-[13px] mb-0.5">
                {flavor.name}
              </div>
              <div className="text-[11px] text-ink-light leading-snug">
                {flavor.desc}
              </div>
              {isPicked && (
                <div
                  className="mt-2.5 bg-white rounded-lg p-3 text-[12.5px] leading-relaxed border border-border [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: flavor.recipe }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
