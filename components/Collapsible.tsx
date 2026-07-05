"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full mb-2 cursor-pointer"
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-light">
          {title}
        </span>
        <span
          className={`text-[10px] text-ink-light transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>
      {subtitle && open && <p className="text-xs text-ink-light mb-3 -mt-1">{subtitle}</p>}
      {open && children}
    </section>
  );
}
