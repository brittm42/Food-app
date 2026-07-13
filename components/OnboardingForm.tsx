"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import PreferencesForm from "@/components/PreferencesForm";
import { updateMyPreferences, skipOnboarding } from "@/app/actions/profile";
import type { Allergy } from "@/lib/types";

export default function OnboardingForm({
  initialAllergies,
  initialAvoidFoods,
  initialCuisinePreferences,
  initialDietaryStyle,
  initialHealthGoals,
}: {
  initialAllergies: Allergy[];
  initialAvoidFoods: string[];
  initialCuisinePreferences: string[];
  initialDietaryStyle: string[];
  initialHealthGoals: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSkip() {
    startTransition(async () => {
      await skipOnboarding();
      router.push("/");
    });
  }

  return (
    <PreferencesForm
      initialAllergies={initialAllergies}
      initialAvoidFoods={initialAvoidFoods}
      initialCuisinePreferences={initialCuisinePreferences}
      initialDietaryStyle={initialDietaryStyle}
      initialHealthGoals={initialHealthGoals}
      saveLabel="Finish"
      onSave={(values) =>
        updateMyPreferences({
          allergies: values.allergies,
          avoidFoods: values.avoidFoods,
          cuisinePreferences: values.cuisinePreferences,
          dietaryStyle: values.dietaryStyle,
          healthGoals: values.healthGoals,
        })
      }
      onSaved={() => router.push("/")}
      secondaryAction={
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="text-sm text-ink-light hover:text-teal cursor-pointer disabled:opacity-50"
        >
          Skip for now
        </button>
      }
    />
  );
}
