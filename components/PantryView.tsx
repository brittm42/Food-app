"use client";

import { useState, useTransition } from "react";
import { CORE_PANTRY, WEEKLY_FRESH } from "@/lib/types";
import type { PantryStaple } from "@/lib/types";
import { toggleChecked, addStaple, deleteStaple } from "@/app/actions/pantry";

export default function PantryView({
  checkedKeys,
  staples,
}: {
  checkedKeys: string[];
  staples: PantryStaple[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newStaple, setNewStaple] = useState("");
  const checked = new Set(checkedKeys);

  function toggle(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  function handleAddStaple(e: React.FormEvent) {
    e.preventDefault();
    const label = newStaple.trim();
    if (!label) return;
    setNewStaple("");
    startTransition(() => {
      addStaple(label);
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

      <section>
        <h1 className="font-display text-xl font-light mb-3">My Staples</h1>
        <div className="flex flex-col gap-1.5 mb-3">
          {staples.map((staple) => {
            const key = `pantry:staple:${staple.id}`;
            const isChecked = checked.has(key);
            return (
              <div
                key={staple.id}
                className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2"
              >
                <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
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
                    {staple.label}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${staple.label}`}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      deleteStaple(staple.id);
                    })
                  }
                  className="text-ink-light hover:text-ink text-xs font-mono px-1"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {staples.length === 0 && (
            <p className="text-xs text-ink-light">
              No staples added yet — things like Nutella or pretzel sticks
              that you always keep stocked.
            </p>
          )}
        </div>
        <form onSubmit={handleAddStaple} className="flex gap-2">
          <input
            type="text"
            value={newStaple}
            onChange={(e) => setNewStaple(e.target.value)}
            placeholder="Add a staple…"
            disabled={isPending}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={isPending || !newStaple.trim()}
            className="font-mono text-[11px] px-3 py-2 rounded-lg bg-ink text-white disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
