"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Recipe, TagColor } from "@/lib/types";
import {
  MEAL_TYPES,
  SUB_CATEGORIES,
  TAG_COLOR_OPTIONS,
  TAG_COLOR_CLASSES,
  autoColorForName,
  canonicalCuisineName,
} from "@/lib/types";
import {
  createRecipe,
  updateRecipe,
  createTagColor,
  createCuisineColor,
  type RecipeInput,
} from "@/app/actions/recipes";
import { generateRecipeDraft, type ChatTurn } from "@/app/actions/generate-recipe";
import {
  importRecipeFromUrl,
  importRecipeFromText,
  importRecipeFromPhotos,
} from "@/app/actions/import-recipe";
import { parseNumericQuantity } from "@/lib/units";
import { resizeImageFile, type ResizedImage } from "@/lib/image-resize";

type ChatMessage = { role: "user" | "assistant"; text: string };

const CHIP_BASE =
  "font-mono text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors";
const CHIP_ACTIVE = "bg-ink text-white border-ink";
const CHIP_INACTIVE = "bg-surface text-ink-light border-border hover:bg-surface-warm";

const INPUT_BASE =
  "border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal";
const INPUT_CLASS = `${INPUT_BASE} w-full`;
const LABEL_CLASS = "block font-mono text-[10px] uppercase tracking-wide text-ink-light mb-1";
const SECTION_CLASS = "bg-surface border border-border rounded-xl p-4 flex flex-col gap-4";
const SECTION_TITLE_CLASS = "font-mono text-[11px] uppercase tracking-wide text-ink-light";

const MAX_PHOTOS = 5;

type FormIngredient = { name: string; core: boolean; quantity: string; unit: string };

type FormState = {
  name: string;
  category: string;
  cuisines: string[];
  dietaryStyle: string[];
  emoji: string;
  hint: string;
  steps: string[];
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  source: string;
  servings: string;
  protein: string;
  fiber: string;
  cal: string;
  tags: string[];
  ingredients: FormIngredient[];
};

function formFromRecipe(recipe?: Recipe | RecipeInput): FormState {
  return {
    name: recipe?.name ?? "",
    category: recipe?.category ?? "",
    cuisines: recipe?.cuisines ?? [],
    // No manual UI for this — AI-inferred only (generation + backfill).
    // Carried through unchanged so a manual edit/re-save never wipes it.
    dietaryStyle: recipe?.dietary_style ?? [],
    emoji: recipe?.emoji ?? "",
    hint: recipe?.hint ?? "",
    steps: recipe?.steps && recipe.steps.length > 0 ? recipe.steps : [""],
    prepTimeMinutes: recipe?.prep_time_minutes != null ? String(recipe.prep_time_minutes) : "",
    cookTimeMinutes: recipe?.cook_time_minutes != null ? String(recipe.cook_time_minutes) : "",
    source: recipe?.source ?? "",
    servings: recipe?.servings != null ? String(recipe.servings) : "",
    protein: recipe?.protein != null ? String(recipe.protein) : "",
    fiber: recipe?.fiber != null ? String(recipe.fiber) : "",
    cal: recipe?.cal != null ? String(recipe.cal) : "",
    tags: recipe?.tags ?? [],
    ingredients: (recipe?.ingredients ?? []).map((ing) => ({
      name: ing.name,
      core: ing.core,
      quantity: ing.quantity ?? "",
      unit: ing.unit ?? "",
    })),
  };
}

function toRecipeInput(
  form: FormState,
  isAiGenerated: boolean,
  importedVia: "link" | "photo" | null
): RecipeInput {
  return {
    name: form.name.trim(),
    category: form.category,
    cuisines: form.cuisines,
    dietary_style: form.dietaryStyle,
    emoji: form.emoji.trim() || null,
    hint: form.hint.trim() || null,
    recipe: null,
    steps: form.steps.map((s) => s.trim()).filter(Boolean),
    prep_time_minutes: form.prepTimeMinutes.trim() ? Number(form.prepTimeMinutes) : null,
    cook_time_minutes: form.cookTimeMinutes.trim() ? Number(form.cookTimeMinutes) : null,
    imported_via: importedVia,
    source: form.source.trim() || null,
    servings: form.servings.trim() ? Number(form.servings) : null,
    protein: form.protein.trim() ? Number(form.protein) : null,
    fiber: form.fiber.trim() ? Number(form.fiber) : null,
    cal: form.cal.trim() ? Number(form.cal) : null,
    tags: form.tags,
    ingredients: form.ingredients
      .filter((i) => i.name.trim())
      .map((i) => {
        const quantity = i.quantity.trim() || null;
        const unit = i.unit.trim() || null;
        // Derived automatically for pantry reconciliation — no new form
        // fields, zero UX change for whoever's typing the recipe in.
        const parsed = parseNumericQuantity(quantity, unit);
        return {
          name: i.name.trim(),
          core: i.core,
          quantity,
          unit,
          quantity_value: parsed?.value ?? null,
          quantity_unit: parsed?.unit ?? null,
        };
      }),
    is_ai_generated: isAiGenerated,
  };
}

export default function RecipeForm({
  mode,
  recipeId,
  initial,
  tagColors,
  cuisineColors,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  initial?: Recipe;
  tagColors: TagColor[];
  cuisineColors: TagColor[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromRecipe(initial));
  const [isAiGenerated, setIsAiGenerated] = useState(Boolean(initial?.is_ai_generated));
  const [importedVia, setImportedVia] = useState<"link" | "photo" | null>(
    initial?.imported_via ?? null
  );
  const [localTagColors, setLocalTagColors] = useState(tagColors);
  const [localCuisineColors, setLocalCuisineColors] = useState(cuisineColors);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ChatTurn[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  const [newCuisineName, setNewCuisineName] = useState("");
  const [newCuisineColor, setNewCuisineColor] = useState<string>(TAG_COLOR_OPTIONS[0]);
  const [sourceMode, setSourceMode] = useState<"ai" | "import" | "photo">("ai");
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [needsManualText, setNeedsManualText] = useState(false);
  const [manualText, setManualText] = useState("");
  const [photos, setPhotos] = useState<ResizedImage[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isResizingPhotos, setIsResizingPhotos] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCuisine(name: string) {
    setForm((f) => ({
      ...f,
      cuisines: f.cuisines.includes(name)
        ? f.cuisines.filter((c) => c !== name)
        : [...f.cuisines, name],
    }));
  }

  // Registers any cuisine an AI draft/import introduced that isn't already
  // a known chip, so it's immediately pickable without a page reload —
  // mirrors handleAddNewTag's local-state-plus-persist pattern below. Also
  // canonicalizes casing against the known list ("italian" -> "Italian" if
  // that already exists) so a harmless casing difference from the model
  // never fragments the vocabulary into near-duplicates; returns the
  // canonicalized list for the caller to use as the form's actual value.
  function reconcileCuisines(cuisines: string[]): string[] {
    const knownNames = localCuisineColors.map((c) => c.name);
    const canonical = cuisines.map((c) => canonicalCuisineName(c, knownNames));
    const known = new Set(knownNames);
    const additions = [...new Set(canonical.filter((name) => !known.has(name)))];
    if (additions.length) {
      additions.forEach((name) => createCuisineColor(name, autoColorForName(name)));
      setLocalCuisineColors((cur) => [
        ...cur,
        ...additions.map((name) => ({ name, color: autoColorForName(name) })),
      ]);
    }
    return canonical;
  }

  function toggleTag(name: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));
  }

  function addIngredientRow() {
    setForm((f) => ({
      ...f,
      ingredients: [...f.ingredients, { name: "", core: false, quantity: "", unit: "" }],
    }));
  }

  function updateIngredientRow(index: number, patch: Partial<FormIngredient>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));
  }

  function removeIngredientRow(index: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, ""] }));
  }

  function updateStep(index: number, value: string) {
    setForm((f) => ({ ...f, steps: f.steps.map((s, i) => (i === index ? value : s)) }));
  }

  function removeStep(index: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setForm((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.steps.length) return f;
      const steps = [...f.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...f, steps };
    });
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

  function handleAddNewCuisine() {
    const name = newCuisineName.trim();
    if (!name) return;
    if (!localCuisineColors.some((c) => c.name === name)) {
      setLocalCuisineColors((cur) => [...cur, { name, color: newCuisineColor }]);
      createCuisineColor(name, newCuisineColor);
    }
    setForm((f) => (f.cuisines.includes(name) ? f : { ...f, cuisines: [...f.cuisines, name] }));
    setNewCuisineName("");
  }

  function handleSendPrompt() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiError(null);
    setChatMessages((m) => [...m, { role: "user", text: prompt }]);
    setAiPrompt("");
    startGenerating(async () => {
      const result = await generateRecipeDraft(prompt, apiHistory);
      if (result.error) {
        setAiError(result.error);
        return;
      }
      if (result.recipe) {
        const canonicalCuisines = reconcileCuisines(result.recipe.cuisines ?? []);
        setForm(formFromRecipe({ ...result.recipe, cuisines: canonicalCuisines }));
        setIsAiGenerated(true);
        setImportedVia(null);
        setApiHistory(result.history ?? []);
        setChatMessages((m) => [
          ...m,
          { role: "assistant", text: result.changeSummary ?? "Here's a first draft — review and edit below." },
        ]);
      }
    });
  }

  function handleResetChat() {
    setChatMessages([]);
    setApiHistory([]);
    setAiPrompt("");
    setAiError(null);
  }

  function handleImportUrl() {
    const url = importUrl.trim();
    if (!url) return;
    setImportError(null);
    setNeedsManualText(false);
    startImporting(async () => {
      const result = await importRecipeFromUrl(url);
      if (result.error) {
        setImportError(result.error);
        setNeedsManualText(Boolean(result.needsManualText));
        return;
      }
      if (result.recipe) {
        const canonicalCuisines = reconcileCuisines(result.recipe.cuisines ?? []);
        setForm(formFromRecipe({ ...result.recipe, cuisines: canonicalCuisines }));
        setIsAiGenerated(false);
        setImportedVia("link");
      }
    });
  }

  function handleImportManualText() {
    if (!manualText.trim()) return;
    setImportError(null);
    startImporting(async () => {
      const result = await importRecipeFromText(manualText, importUrl.trim() || undefined);
      if (result.error) {
        setImportError(result.error);
        return;
      }
      if (result.recipe) {
        const canonicalCuisines = reconcileCuisines(result.recipe.cuisines ?? []);
        setForm(formFromRecipe({ ...result.recipe, cuisines: canonicalCuisines }));
        setIsAiGenerated(false);
        setImportedVia("link");
        setNeedsManualText(false);
        setManualText("");
      }
    });
  }

  async function handlePhotosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    const incoming = Array.from(files).slice(0, room);
    if (files.length > room) {
      setPhotoError(`Up to ${MAX_PHOTOS} photos at a time — only added the first ${room}.`);
    }
    setIsResizingPhotos(true);
    try {
      const resized = await Promise.all(incoming.map(resizeImageFile));
      setPhotos((cur) => [...cur, ...resized]);
    } catch {
      setPhotoError("Couldn't process one of those photos — try again.");
    } finally {
      setIsResizingPhotos(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((cur) => cur.filter((_, i) => i !== index));
  }

  function handleImportPhotos() {
    if (photos.length === 0) return;
    setImportError(null);
    setNeedsManualText(false);
    startImporting(async () => {
      const result = await importRecipeFromPhotos(
        photos.map((p) => ({ mediaType: p.mediaType, data: p.data }))
      );
      if (result.error) {
        setImportError(result.error);
        setNeedsManualText(Boolean(result.needsManualText));
        return;
      }
      if (result.recipe) {
        const canonicalCuisines = reconcileCuisines(result.recipe.cuisines ?? []);
        setForm(formFromRecipe({ ...result.recipe, cuisines: canonicalCuisines }));
        setIsAiGenerated(false);
        setImportedVia("photo");
      }
    });
  }

  function handleSave() {
    setSaveError(null);
    if (!form.name.trim() || !form.steps.some((s) => s.trim()) || !form.category) {
      setSaveError("Name, category, and at least one instruction step are required.");
      return;
    }
    startSaving(async () => {
      const input = toRecipeInput(form, isAiGenerated, importedVia);
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSourceMode("ai")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors ${
            sourceMode === "ai" ? "bg-ink text-white" : "bg-surface-warm text-ink-light"
          }`}
        >
          ✨ AI
        </button>
        <button
          type="button"
          onClick={() => setSourceMode("import")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors ${
            sourceMode === "import" ? "bg-ink text-white" : "bg-surface-warm text-ink-light"
          }`}
        >
          🔗 URL
        </button>
        <button
          type="button"
          onClick={() => setSourceMode("photo")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors ${
            sourceMode === "photo" ? "bg-ink text-white" : "bg-surface-warm text-ink-light"
          }`}
        >
          📷 Photo
        </button>
      </div>

      {sourceMode === "ai" ? (
        <section className="bg-surface-warm rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
              {chatMessages.length === 0 ? "Generate with AI" : "AI recipe chat"}
            </div>
            {chatMessages.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                className="font-mono text-[10px] text-ink-light hover:text-coral cursor-pointer"
              >
                Start over
              </button>
            )}
          </div>
          {chatMessages.length > 0 && (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`text-[13px] leading-snug rounded-lg px-3 py-2 max-w-[85%] ${
                    m.role === "user"
                      ? "bg-ink text-white self-end"
                      : "bg-surface text-ink self-start border border-border"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {isGenerating && (
                <div className="text-[13px] leading-snug rounded-lg px-3 py-2 max-w-[85%] bg-surface text-ink-light self-start border border-border">
                  Thinking…
                </div>
              )}
            </div>
          )}
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={
              chatMessages.length === 0
                ? "Describe the recipe idea — craving, key ingredients, cuisine..."
                : "Ask for a change — \"make it vegetarian\", \"double it\"..."
            }
            rows={2}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            disabled={isGenerating || !aiPrompt.trim()}
            onClick={handleSendPrompt}
            className="bg-plum text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50 self-start px-4"
          >
            {isGenerating ? "Thinking…" : chatMessages.length === 0 ? "✨ Generate with AI" : "Send"}
          </button>
          {aiError && <p className="text-sm text-red">{aiError}</p>}
        </section>
      ) : sourceMode === "import" ? (
        <section className="bg-surface-warm rounded-xl p-4 flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
            Import from URL
          </div>
          <div className="flex gap-2">
            <input
              className={`${INPUT_CLASS} flex-1`}
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="Paste a link to a recipe"
            />
            <button
              type="button"
              disabled={isImporting || !importUrl.trim()}
              onClick={handleImportUrl}
              className="bg-plum text-white rounded-lg py-2 px-4 text-sm font-medium cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {isImporting ? "Importing…" : "Import"}
            </button>
          </div>
          {importError && <p className="text-sm text-red">{importError}</p>}
          {needsManualText && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-light">
                Paste the recipe&apos;s text below instead and we&apos;ll extract it from that.
              </p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste the recipe's ingredients and steps here..."
                rows={6}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                disabled={isImporting || !manualText.trim()}
                onClick={handleImportManualText}
                className="bg-plum text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50 self-start px-4"
              >
                {isImporting ? "Importing…" : "Use this text instead"}
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-surface-warm rounded-xl p-4 flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
            Import from Photo
          </div>
          <p className="text-xs text-ink-light">
            A cookbook page, index card, handwritten note, or printout — up to {MAX_PHOTOS} photos
            for a multi-page recipe.
          </p>
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-16 h-16 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt={`Recipe photo ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center text-[10px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label
              className={`flex-1 border border-dashed border-border rounded-lg py-2 text-sm font-medium text-center cursor-pointer hover:bg-surface transition-colors ${
                photos.length >= MAX_PHOTOS || isResizingPhotos ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {isResizingPhotos ? "Processing…" : "+ Add photo(s)"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={photos.length >= MAX_PHOTOS || isResizingPhotos}
                onChange={(e) => {
                  handlePhotosSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              disabled={isImporting || photos.length === 0}
              onClick={handleImportPhotos}
              className="bg-plum text-white rounded-lg py-2 px-4 text-sm font-medium cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {isImporting ? "Importing…" : "Import"}
            </button>
          </div>
          {photoError && <p className="text-sm text-red">{photoError}</p>}
          {importError && <p className="text-sm text-red">{importError}</p>}
          {needsManualText && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-light">
                Paste the recipe&apos;s text below instead and we&apos;ll extract it from that.
              </p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste the recipe's ingredients and steps here..."
                rows={6}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                disabled={isImporting || !manualText.trim()}
                onClick={handleImportManualText}
                className="bg-plum text-white rounded-lg py-2 text-sm font-medium cursor-pointer disabled:opacity-50 self-start px-4"
              >
                {isImporting ? "Importing…" : "Use this text instead"}
              </button>
            </div>
          )}
        </section>
      )}

      {isAiGenerated && (
        <div className="bg-plum-light text-plum text-xs font-mono uppercase tracking-wide rounded-lg px-3 py-2">
          ✨ AI-drafted — review before saving
        </div>
      )}
      {importedVia && (
        <div className="bg-teal-light text-teal text-xs font-mono uppercase tracking-wide rounded-lg px-3 py-2">
          📥 Imported — review before saving
        </div>
      )}

      <div className={SECTION_CLASS}>
        <div className={SECTION_TITLE_CLASS}>Basics</div>
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
            <option value="" disabled>
              Select a category…
            </option>
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

        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS}>Cuisines</label>
          <div className="flex gap-1.5 flex-wrap">
            {localCuisineColors.map((cc) => (
              <button
                key={cc.name}
                type="button"
                onClick={() => toggleCuisine(cc.name)}
                className={`${CHIP_BASE} ${form.cuisines.includes(cc.name) ? CHIP_ACTIVE : CHIP_INACTIVE}`}
              >
                {cc.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center mt-1">
            <input
              className={INPUT_CLASS}
              placeholder="New cuisine name"
              value={newCuisineName}
              onChange={(e) => setNewCuisineName(e.target.value)}
            />
            <select
              className="border border-border rounded-lg px-2 py-2 text-sm bg-surface"
              value={newCuisineColor}
              onChange={(e) => setNewCuisineColor(e.target.value)}
            >
              {TAG_COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddNewCuisine}
              className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer flex-shrink-0"
            >
              + Add
            </button>
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
      </div>

      <div className={SECTION_CLASS}>
        <div className={SECTION_TITLE_CLASS}>Instructions</div>
        {form.steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="font-mono text-[11px] text-ink-light pt-2.5 w-4 flex-shrink-0">
              {i + 1}.
            </span>
            <textarea
              className={`${INPUT_CLASS} flex-1`}
              rows={2}
              value={step}
              onChange={(e) => updateStep(i, e.target.value)}
              placeholder="Use <strong>...</strong> for emphasis if you'd like."
            />
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
                aria-label="Move step up"
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ink-light hover:bg-surface-warm cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(i, 1)}
                disabled={i === form.steps.length - 1}
                aria-label="Move step down"
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ink-light hover:bg-surface-warm cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeStep(i)}
              aria-label="Remove step"
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ink-light hover:bg-coral-light hover:text-coral cursor-pointer flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addStep}
          className="self-start font-mono text-[11px] text-teal cursor-pointer"
        >
          + Add step
        </button>
      </div>

      <div className={SECTION_CLASS}>
        <div className={SECTION_TITLE_CLASS}>Details</div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Source (optional)</label>
          <input
            className={INPUT_CLASS}
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
            placeholder="Link to where this recipe came from"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
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
            <label className={LABEL_CLASS}>Prep time (min)</label>
            <input
              type="number"
              className={INPUT_CLASS}
              value={form.prepTimeMinutes}
              onChange={(e) => update("prepTimeMinutes", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>Cook time (min)</label>
            <input
              type="number"
              className={INPUT_CLASS}
              value={form.cookTimeMinutes}
              onChange={(e) => update("cookTimeMinutes", e.target.value)}
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
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className={SECTION_TITLE_CLASS}>Tags</div>
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

      <div className={SECTION_CLASS}>
        <div className={SECTION_TITLE_CLASS}>Ingredients</div>
        {form.ingredients.length > 0 && (
          <div className="flex gap-2 items-center px-0.5 -mb-2">
            <span className="text-[10px] text-ink-light w-14 flex-shrink-0">Qty</span>
            <span className="text-[10px] text-ink-light w-20 flex-shrink-0">Unit</span>
            <span className="text-[10px] text-ink-light flex-1">Name</span>
            <span className="text-[10px] text-ink-light w-[52px] flex-shrink-0 text-center">Type</span>
            <span className="w-7 flex-shrink-0" />
          </div>
        )}
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className={`${INPUT_BASE} w-14 flex-shrink-0`}
              value={ing.quantity}
              onChange={(e) => updateIngredientRow(i, { quantity: e.target.value })}
              placeholder="1"
            />
            <input
              className={`${INPUT_BASE} w-20 flex-shrink-0`}
              value={ing.unit}
              onChange={(e) => updateIngredientRow(i, { unit: e.target.value })}
              placeholder="cup"
            />
            <input
              className={`${INPUT_CLASS} flex-1`}
              value={ing.name}
              onChange={(e) => updateIngredientRow(i, { name: e.target.value })}
              placeholder="Ingredient name"
            />
            <button
              type="button"
              onClick={() => updateIngredientRow(i, { core: !ing.core })}
              className={`${CHIP_BASE} ${ing.core ? CHIP_ACTIVE : CHIP_INACTIVE} flex-shrink-0 w-[52px] text-center`}
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 border border-border text-ink rounded-lg py-2.5 text-sm font-medium cursor-pointer hover:bg-surface-warm"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex-1 bg-ink text-white rounded-lg py-2.5 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {isSaving ? "Saving…" : mode === "create" ? "Save Recipe" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
