"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  subtitle,
  defaultOpen = true,
  level = "category",
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  // "section" is a top-level grouping (e.g. Fresh/Pantry) that contains
  // nested "category" Collapsibles (e.g. Produce, Dairy & Eggs) — gets more
  // visual weight so the hierarchy actually reads, instead of every level
  // looking identical.
  level?: "section" | "category";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between w-full cursor-pointer ${
          level === "section" ? "mb-3" : "mb-2"
        }`}
      >
        <span
          className={
            level === "section"
              ? "font-display text-lg font-normal text-ink"
              : "font-mono text-[10px] uppercase tracking-wide text-ink-light"
          }
        >
          {title}
        </span>
        <span
          className={`text-[10px] text-ink-light transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>
      {subtitle && open && <p className="text-xs text-ink-light mb-3 -mt-1">{subtitle}</p>}
      {open && (
        <div className={level === "section" ? "pl-1" : undefined}>{children}</div>
      )}
    </section>
  );
}
