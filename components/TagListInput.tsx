"use client";

import { useState } from "react";

export default function TagListInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 bg-surface-warm border border-border rounded-full px-3 py-1 text-xs"
            >
              {value}
              <button
                type="button"
                onClick={() => remove(value)}
                className="text-ink-light hover:text-red cursor-pointer"
                aria-label={`Remove ${value}`}
              >
                ✕
              </button>
            </span>
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
