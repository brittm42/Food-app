"use client";

import { useState, useTransition } from "react";
import { updateHouseholdCookingProfile } from "@/app/actions/household";
import { MEAL_TYPES, SKILL_LEVELS } from "@/lib/types";
import type { MealType, SkillLevel } from "@/lib/types";

export default function HouseholdCookingProfilePanel({
  householdSize: initialHouseholdSize,
  mealPriorities: initialMealPriorities,
  weeknightTimeMinutes: initialWeeknightTimeMinutes,
  skillLevel: initialSkillLevel,
  isPrivileged,
}: {
  householdSize: number | null;
  mealPriorities: MealType[];
  weeknightTimeMinutes: number | null;
  skillLevel: SkillLevel | null;
  isPrivileged: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [householdSize, setHouseholdSize] = useState(initialHouseholdSize);
  const [mealPriorities, setMealPriorities] = useState(initialMealPriorities);
  const [weeknightTimeMinutes, setWeeknightTimeMinutes] = useState(initialWeeknightTimeMinutes);
  const [skillLevel, setSkillLevel] = useState(initialSkillLevel);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleMeal(id: MealType) {
    setMealPriorities((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateHouseholdCookingProfile({
        householdSize,
        mealPriorities,
        weeknightTimeMinutes,
        skillLevel,
      });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  if (!isPrivileged) {
    const hasAny = householdSize || mealPriorities.length || weeknightTimeMinutes || skillLevel;
    return (
      <section className="mt-8 pt-6 border-t border-border">
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
          Cooking Profile
        </h2>
        <p className="text-sm text-ink-light">
          {!hasAny && "Not set yet."}
          {householdSize ? `${householdSize} in the household. ` : ""}
          {mealPriorities.length ? `Meals that matter most: ${mealPriorities.join(", ")}. ` : ""}
          {weeknightTimeMinutes ? `~${weeknightTimeMinutes} min on weeknights. ` : ""}
          {skillLevel ? `${skillLevel} cook.` : ""}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSave} className="mt-8 pt-6 border-t border-border">
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        Cooking Profile
      </h2>
      <p className="text-sm text-ink-light mb-3">
        Helps AI-drafted recipes fit how this household actually cooks.
      </p>

      <div className="mb-3">
        <label className="text-xs text-ink-light block mb-1">Household size</label>
        <input
          type="number"
          min={1}
          value={householdSize ?? ""}
          onChange={(e) => {
            setHouseholdSize(e.target.value ? Number(e.target.value) : null);
            setSaved(false);
          }}
          className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal"
        />
      </div>

      <div className="mb-3">
        <label className="text-xs text-ink-light block mb-1">Meals that matter most</label>
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map((meal) => {
            const active = mealPriorities.includes(meal.id);
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => toggleMeal(meal.id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active
                    ? "bg-teal text-white border-teal"
                    : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {meal.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-ink-light block mb-1">Weeknight cooking time (minutes)</label>
        <input
          type="number"
          min={0}
          value={weeknightTimeMinutes ?? ""}
          onChange={(e) => {
            setWeeknightTimeMinutes(e.target.value ? Number(e.target.value) : null);
            setSaved(false);
          }}
          className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal"
        />
      </div>

      <div className="mb-4">
        <label className="text-xs text-ink-light block mb-1">Cooking skill level</label>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_LEVELS.map((level) => {
            const active = skillLevel === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  setSkillLevel(active ? null : level.id);
                  setSaved(false);
                }}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active
                    ? "bg-teal text-white border-teal"
                    : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {level.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {error && <p className="text-sm text-red mt-2">{error}</p>}
      {saved && !error && <p className="text-sm text-teal mt-2">Saved.</p>}
    </form>
  );
}
