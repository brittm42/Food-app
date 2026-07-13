"use client";

import { useMemo, useState } from "react";
import type { Recipe, TagColor } from "@/lib/types";
import DiscoverRecipeCard from "@/components/DiscoverRecipeCard";

export default function DiscoverBrowser({
  recipes,
  tagColors,
  alreadyImportedIds,
}: {
  recipes: Recipe[];
  tagColors: TagColor[];
  alreadyImportedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const importedSet = useMemo(() => new Set(alreadyImportedIds), [alreadyImportedIds]);

  const visibleRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.hint ?? "").toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [recipes, query]);

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
      {visibleRecipes.length === 0 ? (
        <div className="text-center text-ink-light text-sm py-10">
          {recipes.length === 0
            ? "No public recipes from other kitchens yet."
            : "No recipes match your search."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleRecipes.map((recipe) => (
            <DiscoverRecipeCard
              key={recipe.id}
              recipe={recipe}
              tagColors={tagColors}
              alreadyImported={importedSet.has(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
