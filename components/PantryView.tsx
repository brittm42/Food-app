"use client";

import { useTransition } from "react";
import { CORE_PANTRY, WEEKLY_FRESH } from "@/lib/types";
import { toggleChecked } from "@/app/actions/pantry";

export default function PantryView({ checkedKeys }: { checkedKeys: string[] }) {
  const [isPending, startTransition] = useTransition();
  const checked = new Set(checkedKeys);

  function toggle(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h1 className="font-display text-xl font-light mb-1">Core Pantry</h1>
        <p className="text-xs text-ink-light mb-4">
          If this is stocked, you can always make something.
        </p>
        <div className="flex flex-col gap-5">
          {CORE_PANTRY.map((cat) => (
            <div key={cat.category}>
              <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
                {cat.category}
              </h2>
              <div className="flex flex-col gap-1.5">
                {cat.items.map((item) => {
                  const key = `pantry:core:${cat.category}:${item}`;
                  const isChecked = checked.has(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isPending}
                        onChange={() => toggle(key)}
                        className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
                      />
                      <span
                        className={`text-sm ${isChecked ? "line-through text-ink-light" : ""}`}
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h1 className="font-display text-xl font-light mb-3">Weekly Fresh</h1>
        <div className="flex flex-col gap-1.5">
          {WEEKLY_FRESH.map((item) => {
            const key = `pantry:fresh:${item.label}`;
            const isChecked = checked.has(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isPending}
                  onChange={() => toggle(key)}
                  className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
                />
                <span
                  className={`text-sm ${isChecked ? "line-through text-ink-light" : ""}`}
                >
                  {item.label}
                  {item.note && (
                    <span className="text-ink-light text-xs"> — {item.note}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
