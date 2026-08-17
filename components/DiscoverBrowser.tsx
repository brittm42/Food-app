"use client";

import { useMemo, useState } from "react";
import type { Recipe, TagColor, MealType } from "@/lib/types";
import { MEAL_TYPES, SUB_CATEGORIES } from "@/lib/types";
import DiscoverRecipeCard from "@/components/DiscoverRecipeCard";

const TAB_BASE =
  "flex-shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors";
const TAB_ACTIVE = "bg-ink text-white border-ink";
const TAB_INACTIVE = "bg-surface text-ink-light border-border hover:bg-surface-warm";

// No "Just for Me" tab here, deliberately — that categorization is
// personal to a household and doesn't translate to someone else's public
// recipe. Any solo-tagged public recipes just don't surface on Discover.
const DISCOVER_MEAL_TYPES = MEAL_TYPES.filter((m) => m.id !== "solo");

export default function DiscoverBrowser({
  recipes,
  tagColors,
  cuisineColors,
  alreadyImportedIds,
}: {
  recipes: Recipe[];
  tagColors: TagColor[];
  cuisineColors: TagColor[];
  alreadyImportedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const subCats = SUB_CATEGORIES[activeMeal];
  const [activeSub, setActiveSub] = useState(subCats[0].id);
  const importedSet = useMemo(() => new Set(alreadyImportedIds), [alreadyImportedIds]);

  function selectMeal(meal: MealType) {
    setActiveMeal(meal);
    setActiveSub(SUB_CATEGORIES[meal][0].id);
  }

  const recipesByCategory = useMemo(() => {
    const map: Record<string, Recipe[]> = {};
    for (const r of recipes) {
      (map[r.category] ??= []).push(r);
    }
    return map;
  }, [recipes]);

  const visibleSubCats = SUB_CATEGORIES[activeMeal];

  const visibleRecipes = useMemo(() => {
    const inCategory = recipesByCategory[activeSub] ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return inCategory;
    return inCategory.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.hint ?? "").toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [recipesByCategory, activeSub, query]);

  return (
    <div>
      <div className="mb-4">
        <div className="font-display text-lg font-light mb-1">Discover</div>
        <p className="text-sm text-ink-light">
          Recipes other kitchens have made public. Import one to add your own editable copy.
        </p>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, hint, or tag..."
        className="w-full mb-4 px-3.5 py-2.5 rounded-full border border-border bg-surface text-sm placeholder:text-ink-light focus:outline-none focus:border-teal"
      />

      <div className="flex gap-2 overflow-x-auto mb-5">
        {DISCOVER_MEAL_TYPES.map((meal) => (
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

      {visibleRecipes.length === 0 ? (
        <div className="text-center text-ink-light text-sm py-10">
          {recipes.length === 0
            ? "No public recipes from other kitchens yet."
            : "No recipes here yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleRecipes.map((recipe) => (
            <DiscoverRecipeCard
              key={recipe.id}
              recipe={recipe}
              tagColors={tagColors}
              cuisineColors={cuisineColors}
              alreadyImported={importedSet.has(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
