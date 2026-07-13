"use client";

import { useState, useTransition } from "react";
import type { Allergy } from "@/lib/types";
import { CUISINE_LABELS, DIETARY_STYLES, HEALTH_GOALS } from "@/lib/types";
import TagListInput from "@/components/TagListInput";
import AllergyListInput from "@/components/AllergyListInput";

export type PreferencesFormValues = {
  displayName?: string;
  allergies: Allergy[];
  avoidFoods: string[];
  cuisinePreferences: string[];
  dietaryStyle: string[];
  healthGoals: string[];
};

export default function PreferencesForm({
  initialDisplayName,
  initialAllergies,
  initialAvoidFoods,
  initialCuisinePreferences,
  initialDietaryStyle,
  initialHealthGoals,
  onSave,
  onSaved,
  saveLabel = "Save",
  secondaryAction,
}: {
  initialDisplayName?: string;
  initialAllergies: Allergy[];
  initialAvoidFoods: string[];
  initialCuisinePreferences: string[];
  initialDietaryStyle: string[];
  initialHealthGoals: string[];
  onSave: (values: PreferencesFormValues) => Promise<{ error?: string }>;
  onSaved?: () => void;
  saveLabel?: string;
  secondaryAction?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [allergies, setAllergies] = useState(initialAllergies);
  const [avoidFoods, setAvoidFoods] = useState(initialAvoidFoods);
  const [cuisinePreferences, setCuisinePreferences] = useState(initialCuisinePreferences);
  const [dietaryStyle, setDietaryStyle] = useState(initialDietaryStyle);
  const [healthGoals, setHealthGoals] = useState(initialHealthGoals);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleCuisine(id: string) {
    setCuisinePreferences((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setSaved(false);
  }

  function toggleDietaryStyle(id: string) {
    setDietaryStyle((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
    setSaved(false);
  }

  function toggleHealthGoal(id: string) {
    setHealthGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await onSave({
        displayName: initialDisplayName !== undefined ? displayName : undefined,
        allergies,
        avoidFoods,
        cuisinePreferences,
        dietaryStyle,
        healthGoals,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        onSaved?.();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {initialDisplayName !== undefined && (
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
            Name
          </h2>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            placeholder="Their name"
            maxLength={60}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
          />
        </div>
      )}

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Allergies or dietary restrictions
        </h2>
        <p className="text-xs text-ink-light mb-2">
          Recipes and AI drafts will steer clear of these.
        </p>
        <AllergyListInput
          values={allergies}
          onChange={(v) => {
            setAllergies(v);
            setSaved(false);
          }}
          placeholder="e.g. eggs, peanuts, gluten"
        />
      </div>

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Foods to avoid
        </h2>
        <p className="text-xs text-ink-light mb-2">
          Not allergies — just things this person would rather skip.
        </p>
        <TagListInput
          values={avoidFoods}
          onChange={(v) => {
            setAvoidFoods(v);
            setSaved(false);
          }}
          placeholder="e.g. cilantro, mushrooms"
        />
      </div>

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Cuisines enjoyed
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CUISINE_LABELS).map(([id, label]) => {
            const active = cuisinePreferences.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleCuisine(id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active
                    ? "bg-teal text-white border-teal"
                    : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Dietary style
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(DIETARY_STYLES).map(([id, label]) => {
            const active = dietaryStyle.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleDietaryStyle(id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active
                    ? "bg-teal text-white border-teal"
                    : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Health goals
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(HEALTH_GOALS).map(([id, label]) => {
            const active = healthGoals.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleHealthGoal(id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active
                    ? "bg-teal text-white border-teal"
                    : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Saving…" : saveLabel}
        </button>
        {secondaryAction}
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {saved && !error && <p className="text-sm text-teal">Saved.</p>}
    </form>
  );
}
