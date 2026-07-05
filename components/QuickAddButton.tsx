"use client";

import { useState } from "react";

export default function QuickAddButton({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="w-9 h-9 rounded-full bg-ink text-white text-lg leading-none flex items-center justify-center cursor-pointer shadow-sm hover:opacity-90 flex-shrink-0"
      >
        +
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl p-4 w-full max-w-xs flex flex-col gap-3"
          >
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
              {label}
            </div>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-light text-sm px-3 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
