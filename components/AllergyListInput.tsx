"use client";

import { useState } from "react";
import type { Allergy, AllergySeverity, AllergyHandling } from "@/lib/types";
import { ALLERGY_SEVERITY_LABELS, ALLERGY_HANDLING_LABELS } from "@/lib/types";

const SEVERITIES: AllergySeverity[] = ["severe", "mild"];
const HANDLINGS: AllergyHandling[] = ["strict_avoidance", "substitution_ok", "just_flag"];

export default function AllergyListInput({
  values,
  onChange,
  placeholder,
}: {
  values: Allergy[];
  onChange: (values: Allergy[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    // Safest default at entry time — a newly typed allergy is treated as
    // "never include" until the person dials it back, same rationale as
    // the migration's default for pre-existing rows.
    onChange([...values, { name: trimmed, severity: "severe", handling: "strict_avoidance" }]);
    setDraft("");
  }

  function remove(name: string) {
    onChange(values.filter((a) => a.name !== name));
  }

  function update(name: string, patch: Partial<Allergy>) {
    onChange(values.map((a) => (a.name === name ? { ...a, ...patch } : a)));
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {values.map((allergy) => (
            <div key={allergy.name} className="border border-border rounded-lg px-3 py-2 bg-surface-warm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{allergy.name}</span>
                <button
                  type="button"
                  onClick={() => remove(allergy.name)}
                  aria-label={`Remove ${allergy.name}`}
                  className="text-ink-light hover:text-red cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update(allergy.name, { severity: s })}
                    className={`rounded-full px-2 py-0.5 text-[11px] border cursor-pointer ${
                      allergy.severity === s
                        ? "bg-red text-white border-red"
                        : "border-border text-ink-light hover:border-red"
                    }`}
                  >
                    {ALLERGY_SEVERITY_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {HANDLINGS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => update(allergy.name, { handling: h })}
                    className={`rounded-full px-2 py-0.5 text-[11px] border cursor-pointer ${
                      allergy.handling === h
                        ? "bg-teal text-white border-teal"
                        : "border-border text-ink-light hover:border-teal"
                    }`}
                  >
                    {ALLERGY_HANDLING_LABELS[h]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="button"
          onClick={add}
          className="border border-border rounded-lg px-3 py-2 text-sm font-medium cursor-pointer hover:bg-surface-warm"
        >
          Add
        </button>
      </div>
    </div>
  );
}
