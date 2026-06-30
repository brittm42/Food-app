"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Recipe, TagColor } from "@/lib/types";
import {
  MEAL_TYPES,
  SUB_CATEGORIES,
  CUISINE_LABELS,
  TAG_COLOR_OPTIONS,
  TAG_COLOR_CLASSES,
} from "@/lib/types";
import { createRecipe, updateRecipe, createTagColor, type RecipeInput } from "@/app/actions/recipes";
import { generateRecipeDraft } from "@/app/actions/generate-recipe";

const CHIP_BASE =
  "font-mono text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors";
const CHIP_ACTIVE = "bg-ink text-white border-ink";
const CHIP_INACTIVE = "bg-surface text-ink-light border-border hover:bg-surface-warm";

const INPUT_CLASS =
  "border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal w-full";
const LABEL_CLASS = "block font-mono text-[10px] uppercase tracking-wide text-ink-light mb-1";

type FormState = {
  name: string;
  category: string;
  cuisines: string[];
  emoji: string;
  hint: string;
  recipe: string;
  source: string;
  servings: string;
  protein: string;
  fiber: string;
  cal: string;
  tags: string[];
  ingredients: { name: string; core: boolean }[];
};

function formFromRecipe(recipe?: Recipe | RecipeInput): FormState {
  return {
    name: recipe?.name ?? "",
    category: recipe?.category ?? SUB_CATEGORIES.breakfast[0].id,
    cuisines: recipe?.cuisines ?? [],
    emoji: recipe?.emoji ?? "",
    hint: recipe?.hint ?? "",
    recipe: recipe?.recipe ?? "",
    source: recipe?.source ?? "",
    servings: recipe?.servings != null ? String(recipe.servings) : "",
    protein: recipe?.protein != null ? String(recipe.protein) : "",
    fiber: recipe?.fiber != null ? String(recipe.fiber) : "",
    cal: recipe?.cal != null ? String(recipe.cal) : "",
    tags: recipe?.tags ?? [],
    ingredients: recipe?.ingredients ?? [],
  };
}

function toRecipeInput(form: FormState, isAiGenerated: boolean): RecipeInput {
  return {
    name: form.name.trim(),
    category: form.category,
    cuisines: form.cuisines,
    emoji: form.emoji.trim() || null,
    hint: form.hint.trim() || null,
    recipe: form.recipe.trim(),
    source: form.source.trim() || null,
    servings: form.servings.trim() ? Number(form.servings) : null,
    protein: form.protein.trim() ? Number(form.protein) : null,
    fiber: form.fiber.trim() ? Number(form.fiber) : null,
    cal: form.cal.trim() ? Number(form.cal) : null,
    tags: form.tags,
    ingredients: form.ingredients.filter((i) => i.name.trim()),
    is_ai_generated: isAiGenerated,
  };
}

export default function RecipeForm({
  mode,
  recipeId,
  initial,
  tagColors,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  initial?: Recipe;
  tagColors: TagColor[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromRecipe(initial));
  const [isAiGenerated, setIsAiGenerated] = useState(Boolean(initial?.is_ai_generated));
  const [localTagColors, setLocalTagColors] = useState(tagColors);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCuisine(id: string) {
    setForm((f) => ({
      ...f,
      cuisines: f.cuisines.includes(id)
        ? f.cuisines.filter((c) => c !== id)
        : [...f.cuisines, id],
    }));
  }

  function toggleTag(name: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));
  }

  function addIngredientRow() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: "", core: false }] }));
  }

  function updateIngredientRow(index: number, patch: Partial<{ name: string; core: boolean }>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));
  }

  function removeIngredientRow(index: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  }

  function handleAddNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    if (!localTagColors.some((t) => t.name === name)) {
      setLocalTagColors((cur) => [...cur, { name, color: newTagColor }]);
      createTagColor(name, newTagColor);
    }
    setForm((f) => (f.tags.includes(name) ? f : { ...f, tags: [...f.tags, name] }));
    setNewTagName("");
  }

  function handleGenerate() {
    setAiError(null);
    startGenerating(async () => {
      const result = await generateRecipeDraft(aiPrompt);
      if (result.error) {
        setAiError(result.error);
        return;
      }
      if (result.recipe) {
        setForm(formFromRecipe(result.recipe));
        setIsAiGenerated(true);
      }
    });
  }

  function handleSave() {
    setSaveError(null);
    if (!form.name.trim() || !form.recipe.trim()) {
      setSaveError("Name and recipe instructions are required.");
      return;
    }
    startSaving(async () => {
      const input = toRecipeInput(form, isAiGenerated);
      const result =
        mode === "create" ? await createRecipe(input) : await updateRecipe(recipeId!, input);
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 flex flex-col gap-6">
      <h1 className="font-display text-xl font-light">
        {mode === "create" ? "Add a Recipe" : "Edit Recipe"}
      </h1>

      <section className="bg-surface-warm rounded-xl p-4 flex flex-col gap-3">
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
          Generate with AI
        </div>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Describe the recipe idea — craving, key ingredients, cuisine..."
          rows={2}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerate}
          className="bg-plum text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50 self-start px-4"
        >
          {isGenerating ? "Drafting…" : "✨ Generate with AI"}
        </button>
        {aiError && <p className="text-sm text-red">{aiError}</p>}
      </section>

      {isAiGenerated && (
        <div className="bg-plum-light text-plum text-xs font-mono uppercase tracking-wide rounded-lg px-3 py-2">
          ✨ AI-drafted — review before saving
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Name</label>
        <input
          className={INPUT_CLASS}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Category</label>
        <select
          className={INPUT_CLASS}
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
        >
          {MEAL_TYPES.map((meal) => (
            <optgroup key={meal.id} label={meal.label}>
              {SUB_CATEGORIES[meal.id].map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Cuisines</label>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(CUISINE_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleCuisine(id)}
              className={`${CHIP_BASE} ${form.cuisines.includes(id) ? CHIP_ACTIVE : CHIP_INACTIVE}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1 w-20">
          <label className={LABEL_CLASS}>Emoji</label>
          <input
            className={INPUT_CLASS}
            value={form.emoji}
            onChange={(e) => update("emoji", e.target.value)}
            maxLength={4}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className={LABEL_CLASS}>Hint line</label>
          <input
            className={INPUT_CLASS}
            value={form.hint}
            onChange={(e) => update("hint", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Instructions</label>
        <textarea
          className={INPUT_CLASS}
          rows={6}
          value={form.recipe}
          onChange={(e) => update("recipe", e.target.value)}
          placeholder="Use <strong>...</strong> for emphasis if you'd like."
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Source (optional)</label>
        <input
          className={INPUT_CLASS}
          value={form.source}
          onChange={(e) => update("source", e.target.value)}
          placeholder="Link to where this recipe came from"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Servings</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={form.servings}
            onChange={(e) => update("servings", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Protein (g)</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={form.protein}
            onChange={(e) => update("protein", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Fiber (g)</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={form.fiber}
            onChange={(e) => update("fiber", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Calories</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={form.cal}
            onChange={(e) => update("cal", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Tags</label>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {localTagColors.map((tc) => (
            <button
              key={tc.name}
              type="button"
              onClick={() => toggleTag(tc.name)}
              className={`font-mono text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                form.tags.includes(tc.name)
                  ? `${TAG_COLOR_CLASSES[tc.color]} border-transparent`
                  : "bg-surface text-ink-light border-border hover:bg-surface-warm"
              }`}
            >
              {tc.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            className={INPUT_CLASS}
            placeholder="New tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
          />
          <select
            className="border border-border rounded-lg px-2 py-2 text-sm bg-surface"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
          >
            {TAG_COLOR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddNewTag}
            className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer flex-shrink-0"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className={LABEL_CLASS}>Ingredients</label>
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className={`${INPUT_CLASS} flex-1`}
              value={ing.name}
              onChange={(e) => updateIngredientRow(i, { name: e.target.value })}
              placeholder="Ingredient name"
            />
            <button
              type="button"
              onClick={() => updateIngredientRow(i, { core: !ing.core })}
              className={`${CHIP_BASE} ${ing.core ? CHIP_ACTIVE : CHIP_INACTIVE} flex-shrink-0`}
            >
              {ing.core ? "Core" : "Fresh"}
            </button>
            <button
              type="button"
              onClick={() => removeIngredientRow(i)}
              aria-label="Remove ingredient"
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ink-light hover:bg-coral-light hover:text-coral cursor-pointer flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addIngredientRow}
          className="self-start font-mono text-[11px] text-teal cursor-pointer"
        >
          + Add ingredient
        </button>
      </div>

      {saveError && <p className="text-sm text-red">{saveError}</p>}

      <button
        type="button"
        disabled={isSaving}
        onClick={handleSave}
        className="bg-ink text-white rounded-lg py-2.5 text-sm font-medium cursor-pointer disabled:opacity-50"
      >
        {isSaving ? "Saving…" : mode === "create" ? "Save Recipe" : "Save Changes"}
      </button>
    </div>
  );
}
