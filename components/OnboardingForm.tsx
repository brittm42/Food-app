"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import PreferencesForm from "@/components/PreferencesForm";
import { updateMyPreferences, skipOnboarding } from "@/app/actions/profile";

export default function OnboardingForm({
  initialAllergies,
  initialAvoidFoods,
  initialCuisinePreferences,
}: {
  initialAllergies: string[];
  initialAvoidFoods: string[];
  initialCuisinePreferences: string[];
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
      saveLabel="Finish"
      onSave={(values) =>
        updateMyPreferences({
          allergies: values.allergies,
          avoidFoods: values.avoidFoods,
          cuisinePreferences: values.cuisinePreferences,
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
