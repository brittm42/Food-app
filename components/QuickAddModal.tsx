"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export default function QuickAddModal({
  triggerAriaLabel,
  headerLabel,
  submitLabel = "Add",
  submitDisabled,
  onSubmit,
  children,
}: {
  triggerAriaLabel: string;
  headerLabel: string;
  submitLabel?: string;
  submitDisabled?: boolean;
  onSubmit: (close: () => void) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    // Blur before unmounting so a still-focused input doesn't leave
    // iOS Safari's zoomed-in viewport stuck after the modal closes.
    (document.activeElement as HTMLElement | null)?.blur();
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(close);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerAriaLabel}
        className="w-9 h-9 rounded-full bg-ink text-white text-lg leading-none flex items-center justify-center cursor-pointer shadow-sm hover:opacity-90 flex-shrink-0"
      >
        +
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4"
          onClick={close}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl p-4 w-full max-w-xs flex flex-col gap-3"
          >
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
              {headerLabel}
            </div>
            {children}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                className="text-ink-light text-sm px-3 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
