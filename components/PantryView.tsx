"use client";

import { useState, useTransition } from "react";
import { CORE_PANTRY, WEEKLY_FRESH } from "@/lib/types";
import type { PantryStaple } from "@/lib/types";
import {
  toggleChecked,
  addStaple,
  deleteStaple,
  removeCatalogItem,
  restoreCatalogItem,
} from "@/app/actions/pantry";
import Collapsible from "@/components/Collapsible";
import QuickAddButton from "@/components/QuickAddButton";

export default function PantryView({
  checkedKeys,
  staples,
  removedKeys,
}: {
  checkedKeys: string[];
  staples: PantryStaple[];
  removedKeys: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newStaple, setNewStaple] = useState("");
  const checked = new Set(checkedKeys);
  const removed = new Set(removedKeys);

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

  function removeCatalog(catalogKey: string) {
    startTransition(() => {
      removeCatalogItem(catalogKey);
    });
  }

  function restoreCatalog(catalogKey: string) {
    startTransition(() => {
      restoreCatalogItem(catalogKey);
    });
  }

  const removedCoreItems = CORE_PANTRY.flatMap((cat) =>
    cat.items
      .map((item) => ({ category: cat.category, item, key: `catalog:core:${cat.category}:${item}` }))
      .filter((row) => removed.has(row.key))
  );
  const removedFreshItems = WEEKLY_FRESH.filter((item) =>
    removed.has(`catalog:fresh:${item.label}`)
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">Pantry</h1>
        <QuickAddButton
          label="Add a Staple"
          placeholder="e.g. Nutella, pretzel sticks…"
          onAdd={(label) =>
            startTransition(() => {
              addStaple(label);
            })
          }
        />
      </div>

      <Collapsible title="Core Pantry" subtitle="If this is stocked, you can always make something.">
        <div className="flex flex-col gap-5">
          {CORE_PANTRY.map((cat) => {
            const visibleItems = cat.items.filter(
              (item) => !removed.has(`catalog:core:${cat.category}:${item}`)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={cat.category}>
                <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
                  {cat.category}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {visibleItems.map((item) => {
                    const neededKey = `needed:core:${cat.category}:${item}`;
                    const catalogKey = `catalog:core:${cat.category}:${item}`;
                    const isNeeded = checked.has(neededKey);
                    return (
                      <div
                        key={catalogKey}
                        className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
                      >
                        <span className="flex-1 text-sm min-w-0">{item}</span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => toggle(neededKey)}
                          className={`font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 ${
                            isNeeded
                              ? "bg-gold text-white"
                              : "bg-surface-warm text-ink-light hover:bg-gold-light"
                          }`}
                        >
                          {isNeeded ? "✓ On list" : "+ Add to list"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={`Remove ${item} from Core Pantry`}
                          onClick={() => removeCatalog(catalogKey)}
                          className="text-ink-light hover:text-red text-xs font-mono px-1 flex-shrink-0 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {removedCoreItems.length > 0 && (
            <Collapsible title={`Removed items (${removedCoreItems.length})`} defaultOpen={false}>
              <div className="flex flex-col gap-1.5">
                {removedCoreItems.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between bg-surface-warm border border-border rounded-lg px-3 py-2 text-sm text-ink-light"
                  >
                    <span>{row.item}</span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => restoreCatalog(row.key)}
                      className="font-mono text-[10px] uppercase tracking-wide text-teal cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Weekly Fresh">
        <div className="flex flex-col gap-1.5">
          {WEEKLY_FRESH.filter((item) => !removed.has(`catalog:fresh:${item.label}`)).map(
            (item) => {
              const key = `pantry:fresh:${item.label}`;
              const catalogKey = `catalog:fresh:${item.label}`;
              const isChecked = checked.has(key);
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
                >
                  <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isPending}
                      onChange={() => toggle(key)}
                      className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
                    />
                    <span className={`text-sm ${isChecked ? "line-through text-ink-light" : ""}`}>
                      {item.label}
                      {item.note && <span className="text-ink-light text-xs"> — {item.note}</span>}
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={isPending}
                    aria-label={`Remove ${item.label} from Weekly Fresh`}
                    onClick={() => removeCatalog(catalogKey)}
                    className="text-ink-light hover:text-red text-xs font-mono px-1 flex-shrink-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              );
            }
          )}
        </div>
        {removedFreshItems.length > 0 && (
          <div className="mt-4">
            <Collapsible title={`Removed items (${removedFreshItems.length})`} defaultOpen={false}>
              <div className="flex flex-col gap-1.5">
                {removedFreshItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between bg-surface-warm border border-border rounded-lg px-3 py-2 text-sm text-ink-light"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => restoreCatalog(`catalog:fresh:${item.label}`)}
                      className="font-mono text-[10px] uppercase tracking-wide text-teal cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        )}
      </Collapsible>

      <Collapsible title="My Staples">
        <div className="flex flex-col gap-1.5 mb-3">
          {staples.map((staple) => {
            const neededKey = `needed:staple:${staple.id}`;
            const isNeeded = checked.has(neededKey);
            return (
              <div
                key={staple.id}
                className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
              >
                <span className="flex-1 text-sm min-w-0">{staple.label}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => toggle(neededKey)}
                  className={`font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 ${
                    isNeeded
                      ? "bg-gold text-white"
                      : "bg-surface-warm text-ink-light hover:bg-gold-light"
                  }`}
                >
                  {isNeeded ? "✓ On list" : "+ Add to list"}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${staple.label}`}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      deleteStaple(staple.id);
                    })
                  }
                  className="text-ink-light hover:text-ink text-xs font-mono px-1 flex-shrink-0 cursor-pointer"
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
      </Collapsible>
    </div>
  );
}
