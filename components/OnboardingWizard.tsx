"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHouseholdName, updateHouseholdCookingProfile, createDependentProfile } from "@/app/actions/household";
import { updateMyPreferences, updateDependentProfile } from "@/app/actions/profile";
import {
  curateStarterRecipes,
  applyStarterRecipeSelections,
  finishOnboarding,
  type CuratedPick,
} from "@/app/actions/onboarding";
import { generateRecipeDraft } from "@/app/actions/generate-recipe";
import { createRecipe, type RecipeInput } from "@/app/actions/recipes";
import PreferencesForm from "@/components/PreferencesForm";
import { MEAL_TYPES, SKILL_LEVELS, CUISINE_LABELS } from "@/lib/types";
import type { Allergy, MealType, SkillLevel } from "@/lib/types";

const STEPS = [
  "household",
  "you",
  "cooking-profile",
  "members",
  "curated-recipes",
  "first-recipe",
  "finishing",
] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  household: "Name your household",
  you: "Tell us about you",
  "cooking-profile": "How this household cooks",
  members: "Anyone else you cook for?",
  "curated-recipes": "A few recipes to start",
  "first-recipe": "Create your first recipe",
  finishing: "Setting things up",
};

type Prefs = {
  allergies: Allergy[];
  avoidFoods: string[];
  cuisinePreferences: string[];
  dietaryStyle: string[];
  healthGoals: string[];
};

type CookingProfile = {
  householdSize: number | null;
  mealPriorities: MealType[];
  weeknightTimeMinutes: number | null;
  skillLevel: SkillLevel | null;
};

type Dependent = { memberId: string; displayName: string; done: boolean };

const BUTTON_PRIMARY =
  "bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50";
const BUTTON_SECONDARY =
  "border border-border rounded-lg px-4 py-2 text-sm cursor-pointer hover:border-teal disabled:opacity-50";

function WizardProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i <= current ? "bg-teal" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

export default function OnboardingWizard({
  initialHouseholdName,
  initialPrefs,
  initialCookingProfile,
  initialDependents,
}: {
  initialHouseholdName: string;
  initialPrefs: Prefs;
  initialCookingProfile: CookingProfile;
  initialDependents: { memberId: string; displayName: string }[];
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [householdName, setHouseholdName] = useState(initialHouseholdName);
  const [cookingProfile, setCookingProfile] = useState(initialCookingProfile);
  const [dependents, setDependents] = useState<Dependent[]>(
    initialDependents.map((d) => ({ ...d, done: Boolean(d.displayName) }))
  );
  const [curatedPicks, setCuratedPicks] = useState<CuratedPick[] | null>(null);
  const [appliedRecipeIds, setAppliedRecipeIds] = useState<Set<string>>(new Set());
  const [savedRecipeCount, setSavedRecipeCount] = useState(0);

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div>
      <h1 className="font-display text-xl font-light mb-1">{STEP_TITLES[step]}</h1>
      <p className="text-sm text-ink-light mb-4">
        A few quick questions so AI-drafted recipes fit what this household actually eats.
      </p>
      <WizardProgress current={stepIndex} total={STEPS.length} />

      {step === "household" && <HouseholdNameStep initialName={householdName} onSaved={setHouseholdName} onNext={next} />}

      {step === "you" && (
        <PreferencesStep initial={initialPrefs} onNext={next} onBack={back} />
      )}

      {step === "cooking-profile" && (
        <CookingProfileStep initial={cookingProfile} onSaved={setCookingProfile} onNext={next} onBack={back} />
      )}

      {step === "members" && (
        <MembersStep dependents={dependents} onChange={setDependents} onNext={next} onBack={back} />
      )}

      {step === "curated-recipes" && (
        <CuratedRecipesStep
          picks={curatedPicks}
          onLoaded={setCuratedPicks}
          appliedRecipeIds={appliedRecipeIds}
          onApplied={setAppliedRecipeIds}
          onNext={next}
          onBack={back}
        />
      )}

      {step === "first-recipe" && (
        <FirstRecipeStep
          savedCount={savedRecipeCount}
          onSaved={() => setSavedRecipeCount((c) => c + 1)}
          onNext={next}
          onBack={back}
        />
      )}

      {step === "finishing" && <FinishingStep onDone={() => router.push("/")} />}
    </div>
  );
}

function HouseholdNameStep({
  initialName,
  onSaved,
  onNext,
}: {
  initialName: string;
  onSaved: (name: string) => void;
  onNext: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your household a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateHouseholdName(trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved(trimmed);
      onNext();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. The Smith House"
        maxLength={60}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
      />
      {error && <p className="text-sm text-red">{error}</p>}
      <button type="button" onClick={handleContinue} disabled={isPending} className={BUTTON_PRIMARY}>
        {isPending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

function PreferencesStep({
  initial,
  onNext,
  onBack,
}: {
  initial: Prefs;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <PreferencesForm
      initialAllergies={initial.allergies}
      initialAvoidFoods={initial.avoidFoods}
      initialCuisinePreferences={initial.cuisinePreferences}
      initialDietaryStyle={initial.dietaryStyle}
      initialHealthGoals={initial.healthGoals}
      saveLabel="Continue"
      onSave={(values) =>
        updateMyPreferences(
          {
            allergies: values.allergies,
            avoidFoods: values.avoidFoods,
            cuisinePreferences: values.cuisinePreferences,
            dietaryStyle: values.dietaryStyle,
            healthGoals: values.healthGoals,
          },
          false
        )
      }
      onSaved={onNext}
      secondaryAction={
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Back
        </button>
      }
    />
  );
}

function CookingProfileStep({
  initial,
  onSaved,
  onNext,
  onBack,
}: {
  initial: CookingProfile;
  onSaved: (profile: CookingProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [householdSize, setHouseholdSize] = useState(initial.householdSize);
  const [mealPriorities, setMealPriorities] = useState(initial.mealPriorities);
  const [weeknightTimeMinutes, setWeeknightTimeMinutes] = useState(initial.weeknightTimeMinutes);
  const [skillLevel, setSkillLevel] = useState(initial.skillLevel);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleMeal(id: MealType) {
    setMealPriorities((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const profile = { householdSize, mealPriorities, weeknightTimeMinutes, skillLevel };
      const result = await updateHouseholdCookingProfile(profile);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved(profile);
      onNext();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-ink-light block mb-1">How many people (incl. kids) do you cook for?</label>
        <input
          type="number"
          min={1}
          value={householdSize ?? ""}
          onChange={(e) => setHouseholdSize(e.target.value ? Number(e.target.value) : null)}
          className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal"
        />
      </div>

      <div>
        <label className="text-xs text-ink-light block mb-1">Meals that matter most</label>
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.filter((m) => m.id !== "solo").map((meal) => {
            const active = mealPriorities.includes(meal.id);
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => toggleMeal(meal.id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active ? "bg-teal text-white border-teal" : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {meal.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-ink-light block mb-1">Weeknight cooking time (minutes)</label>
        <input
          type="number"
          min={0}
          value={weeknightTimeMinutes ?? ""}
          onChange={(e) => setWeeknightTimeMinutes(e.target.value ? Number(e.target.value) : null)}
          className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal"
        />
      </div>

      <div>
        <label className="text-xs text-ink-light block mb-1">Cooking skill level</label>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_LEVELS.map((level) => {
            const active = skillLevel === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setSkillLevel(active ? null : level.id)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${
                  active ? "bg-teal text-white border-teal" : "border-border text-ink-light hover:border-teal"
                }`}
              >
                {level.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleContinue} disabled={isPending} className={BUTTON_PRIMARY}>
          {isPending ? "Saving…" : "Continue"}
        </button>
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Back
        </button>
      </div>
    </div>
  );
}

const EMPTY_PREFS: Prefs = {
  allergies: [],
  avoidFoods: [],
  cuisinePreferences: [],
  dietaryStyle: [],
  healthGoals: [],
};

function MembersStep({
  dependents,
  onChange,
  onNext,
  onBack,
}: {
  dependents: Dependent[];
  onChange: (dependents: Dependent[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await createDependentProfile(trimmed);
      if (result?.error || !result.memberId) {
        setError(result?.error ?? "Could not add that person.");
        return;
      }
      onChange([...dependents, { memberId: result.memberId, displayName: trimmed, done: false }]);
      setActiveMemberId(result.memberId);
      setAdding(false);
      setNewName("");
    });
  }

  const activeDependent = dependents.find((d) => d.memberId === activeMemberId);

  if (activeDependent) {
    return (
      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-3">
          {activeDependent.displayName}&apos;s preferences
        </h2>
        <PreferencesForm
          initialAllergies={EMPTY_PREFS.allergies}
          initialAvoidFoods={EMPTY_PREFS.avoidFoods}
          initialCuisinePreferences={EMPTY_PREFS.cuisinePreferences}
          initialDietaryStyle={EMPTY_PREFS.dietaryStyle}
          initialHealthGoals={EMPTY_PREFS.healthGoals}
          saveLabel="Save"
          onSave={(values) =>
            updateDependentProfile(activeDependent.memberId, {
              displayName: activeDependent.displayName,
              allergies: values.allergies,
              avoidFoods: values.avoidFoods,
              cuisinePreferences: values.cuisinePreferences,
              dietaryStyle: values.dietaryStyle,
              healthGoals: values.healthGoals,
            })
          }
          onSaved={() => {
            onChange(
              dependents.map((d) => (d.memberId === activeDependent.memberId ? { ...d, done: true } : d))
            );
            setActiveMemberId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {dependents.length > 0 && (
        <ul className="flex flex-col gap-2">
          {dependents.map((d) => (
            <li
              key={d.memberId}
              className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm"
            >
              <span>{d.displayName}</span>
              {d.done ? (
                <span className="text-teal text-xs">Saved</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveMemberId(d.memberId)}
                  className="text-xs text-ink-light hover:text-teal cursor-pointer"
                >
                  Finish their preferences
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Their name"
            autoFocus
            maxLength={60}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
          />
          <button type="submit" disabled={isPending} className={BUTTON_PRIMARY}>
            Add
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={BUTTON_SECONDARY}>
          + Add someone else you cook for
        </button>
      )}
      {error && <p className="text-sm text-red">{error}</p>}

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={dependents.some((d) => !d.done)}
          className={BUTTON_PRIMARY}
        >
          {dependents.length === 0 ? "No one else — continue" : "Continue"}
        </button>
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Back
        </button>
      </div>
    </div>
  );
}

function CuratedRecipesStep({
  picks,
  onLoaded,
  appliedRecipeIds,
  onApplied,
  onNext,
  onBack,
}: {
  picks: CuratedPick[] | null;
  onLoaded: (picks: CuratedPick[]) => void;
  appliedRecipeIds: Set<string>;
  onApplied: (ids: Set<string>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(picks === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(() => new Set((picks ?? []).map((p) => p.recipeId)));
  const [isPending, startTransition] = useTransition();
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (picks !== null) return; // already loaded once — kept was initialized from it above
    // Guards against React StrictMode's dev-only double-effect-invocation
    // firing this twice — curateStarterRecipes() is a real, non-idempotent
    // paid AI call, not just a state update. Deliberately no cleanup/
    // cancelled-flag here: StrictMode's fake unmount would set it before
    // this one real fetch resolves, silently discarding its result and
    // leaving the step stuck loading forever. The ref alone is enough to
    // guarantee exactly one fetch, and it's fine to apply that fetch's
    // result whenever it resolves.
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    curateStarterRecipes().then((result) => {
      if (result.error) {
        setLoadError(result.error);
      } else {
        onLoaded(result.picks ?? []);
        setKept(new Set((result.picks ?? []).map((p) => p.recipeId)));
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    const toApply = [...kept].filter((id) => !appliedRecipeIds.has(id));
    if (toApply.length === 0) {
      onNext();
      return;
    }
    startTransition(async () => {
      await applyStarterRecipeSelections(toApply);
      onApplied(new Set([...appliedRecipeIds, ...toApply]));
      onNext();
    });
  }

  if (loading) {
    return <p className="text-sm text-ink-light">Picking recipes that fit your household…</p>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-red">{loadError}</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onNext} className={BUTTON_PRIMARY}>
            Skip for now
          </button>
          <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const grouped = new Map<string, CuratedPick[]>();
  for (const pick of picks ?? []) {
    if (!grouped.has(pick.mealType)) grouped.set(pick.mealType, []);
    grouped.get(pick.mealType)!.push(pick);
  }

  if ((picks ?? []).length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-light">
          Nothing in the library fit your preferences well enough to suggest — no problem, you&apos;ll create your
          own next.
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onNext} className={BUTTON_PRIMARY}>
            Continue
          </button>
          <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-light">
        Picked for your household — uncheck anything that&apos;s not a fit. The rest land in This Week.
      </p>
      {[...grouped.entries()].map(([mealType, mealPicks]) => (
        <div key={mealType}>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">{mealType}</h2>
          <div className="flex flex-col gap-2">
            {mealPicks.map((pick) => {
              const isKept = kept.has(pick.recipeId);
              return (
                <button
                  key={pick.recipeId}
                  type="button"
                  onClick={() => toggle(pick.recipeId)}
                  className={`text-left border rounded-xl p-3 cursor-pointer transition-colors ${
                    isKept ? "border-teal bg-teal-light/30" : "border-border opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {pick.emoji} {pick.name}
                    </span>
                    <span className={`text-xs ${isKept ? "text-teal" : "text-ink-light"}`}>
                      {isKept ? "✓ Keeping" : "Skipped"}
                    </span>
                  </div>
                  {pick.cuisines.length > 0 && (
                    <p className="text-xs text-ink-light mt-0.5">
                      {pick.cuisines.map((c) => CUISINE_LABELS[c] ?? c).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-ink-light mt-1 italic">{pick.reason}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleContinue} disabled={isPending} className={BUTTON_PRIMARY}>
          {isPending ? "Adding to your kitchen…" : "Continue"}
        </button>
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Back
        </button>
      </div>
    </div>
  );
}

function FirstRecipeStep({
  savedCount,
  onSaved,
  onNext,
  onBack,
}: {
  savedCount: number;
  onSaved: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<RecipeInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setError(null);
    startGenerating(async () => {
      const result = await generateRecipeDraft(trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(result.recipe ?? null);
    });
  }

  function handleSave() {
    if (!draft) return;
    setError(null);
    startSaving(async () => {
      const result = await createRecipe(draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
      setPrompt("");
      onSaved();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-light">
        {savedCount === 0
          ? "Describe a recipe idea — a craving, key ingredients, a cuisine. We'll draft it for you to review."
          : `${savedCount} recipe${savedCount > 1 ? "s" : ""} saved. Generate another, or continue.`}
      </p>

      {!draft && (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. a quick weeknight chicken stir-fry with lots of veggies"
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal resize-none"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={BUTTON_PRIMARY}
          >
            {isGenerating ? "Drafting…" : "✨ Generate with AI"}
          </button>
        </>
      )}

      {draft && (
        <div className="border border-teal rounded-xl p-4">
          <p className="text-xs text-teal mb-2">✨ AI-drafted — review before saving</p>
          <p className="text-sm font-medium mb-1">
            {draft.emoji} {draft.name}
          </p>
          <p className="text-xs text-ink-light mb-2">{draft.hint}</p>
          <p className="text-xs text-ink-light">
            {draft.ingredients?.length ?? 0} ingredients · {draft.steps?.length ?? 0} steps
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button type="button" onClick={handleSave} disabled={isSaving} className={BUTTON_PRIMARY}>
              {isSaving ? "Saving…" : "Save this recipe"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={BUTTON_SECONDARY}>
              Discard
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red">{error}</p>}

      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={onNext} disabled={savedCount === 0} className={BUTTON_PRIMARY}>
          Continue
        </button>
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          Back
        </button>
      </div>
      {savedCount === 0 && (
        <p className="text-xs text-ink-light">Save at least one recipe to continue.</p>
      )}
    </div>
  );
}

function FinishingStep({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Same StrictMode double-invoke guard as CuratedRecipesStep, and same
    // reason to skip a cleanup/cancelled flag — finishOnboarding() does
    // real writes (pantry_items inserts, onboarding_status), so firing it
    // twice risks duplicate rows, not just a wasted call, and a cancelled
    // flag tied to StrictMode's fake unmount would discard the one real
    // call's result and leave this step stuck.
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    finishOnboarding().then((result) => {
      if (result.error) {
        setError(result.error);
        setStatus("error");
      } else {
        setStatus("done");
      }
    });
  }, []);

  if (status === "working") {
    return <p className="text-sm text-ink-light">Stocking your Kitchen from your recipes…</p>;
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-red">{error}</p>
        <button type="button" onClick={onDone} className={BUTTON_PRIMARY}>
          Continue anyway
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-light">
        Your Kitchen is stocked with the pantry basics your recipes need, and everything else is ready on your
        Shopping List.
      </p>
      <button type="button" onClick={onDone} className={BUTTON_PRIMARY}>
        Let&apos;s cook
      </button>
    </div>
  );
}
