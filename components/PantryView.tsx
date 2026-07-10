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
import { setPantryOnHand } from "@/app/actions/pantry-on-hand";
import { UNIT_OPTIONS } from "@/lib/units";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";
import SwipeableRow from "@/components/SwipeableRow";

type OnHandRow = { ingredient_name: string; quantity_value: number | null; quantity_unit: string | null };

// Core Pantry catalog entries carry a parenthetical quantity note baked
// into the item string (e.g. "Black beans (4 cans)") — strip it to get the
// bare ingredient name pantry_on_hand/reconciliation actually key on
// (matches the identical stripQty helper in app/shopping/page.tsx).
const stripQty = (item: string) => item.replace(/\s*\(.*\)\s*$/, "").trim();

function OnHandControl({
  ingredientName,
  initial,
}: {
  ingredientName: string;
  initial: OnHandRow | undefined;
}) {
  const [value, setValue] = useState(initial?.quantity_value != null ? String(initial.quantity_value) : "");
  const [unit, setUnit] = useState(initial?.quantity_unit ?? "");
  const [isPending, startTransition] = useTransition();

  function save(nextValue: string, nextUnit: string) {
    const parsedValue = nextValue.trim() ? Number(nextValue) : null;
    startTransition(() => {
      setPantryOnHand(ingredientName, parsedValue, nextUnit || null);
    });
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value, unit)}
        placeholder="qty"
        aria-label={`On-hand quantity for ${ingredientName}`}
        className="w-16 border border-border rounded-lg px-2 py-1 text-xs bg-surface focus:outline-none focus:border-teal"
      />
      <select
        value={unit}
        disabled={isPending}
        onChange={(e) => {
          setUnit(e.target.value);
          save(value, e.target.value);
        }}
        aria-label={`On-hand unit for ${ingredientName}`}
        className="border border-border rounded-lg px-1 py-1 text-xs bg-surface focus:outline-none focus:border-teal"
      >
        <option value="">unit</option>
        {UNIT_OPTIONS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.value}
          </option>
        ))}
      </select>
    </div>
  );
}

function AddStapleButton() {
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = label.trim();
    if (!trimmed) return;
    startTransition(() => {
      addStaple(trimmed, quantity.trim() || null);
    });
    setLabel("");
    setQuantity("");
    close();
  }

  return (
    <QuickAddModal
      triggerAriaLabel="Add a Staple"
      headerLabel="Add a Staple"
      submitDisabled={isPending}
      onSubmit={submit}
    >
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Nutella, pretzel sticks…"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Quantity (optional) — e.g. 2 jars"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
    </QuickAddModal>
  );
}

export default function PantryView({
  checkedKeys,
  staples,
  removedKeys,
  onHand,
  queuedCoreNames,
}: {
  checkedKeys: string[];
  staples: PantryStaple[];
  removedKeys: string[];
  onHand: OnHandRow[];
  queuedCoreNames: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const checked = new Set(checkedKeys);
  const removed = new Set(removedKeys);
  const onHandByName = new Map(onHand.map((row) => [row.ingredient_name, row]));

  const coreCatalogBareNames = new Set(
    CORE_PANTRY.flatMap((cat) => cat.items.map((item) => stripQty(item).toLowerCase()))
  );
  const otherCoreNames = queuedCoreNames.filter(
    (name) => !coreCatalogBareNames.has(name.trim().toLowerCase())
  );

  function toggle(key: string) {
    startTransition(() => {
      toggleChecked(key);
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
        <AddStapleButton />
      </div>

      <Collapsible title="Core Pantry" subtitle="If this is stocked, you can always make something.">
        <div className="flex flex-col gap-5">
          {CORE_PANTRY.map((cat) => {
            const visibleItems = cat.items.filter(
              (item) => !removed.has(`catalog:core:${cat.category}:${item}`)
            );
            if (visibleItems.length === 0) return null;
            return (
              <Collapsible key={cat.category} title={cat.category}>
                <div className="flex flex-col gap-1.5">
                  {visibleItems.map((item) => {
                    const neededKey = `needed:core:${cat.category}:${item}`;
                    const catalogKey = `catalog:core:${cat.category}:${item}`;
                    const isNeeded = checked.has(neededKey);
                    const bareName = stripQty(item);
                    return (
                      <SwipeableRow
                        key={catalogKey}
                        disabled={isPending}
                        deleteLabel={`Remove ${item} from Core Pantry`}
                        onDelete={() => removeCatalog(catalogKey)}
                      >
                        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                          <span className="flex-1 text-sm min-w-0">{item}</span>
                          <OnHandControl
                            ingredientName={bareName}
                            initial={onHandByName.get(bareName.toLowerCase())}
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => toggle(neededKey)}
                            aria-label={isNeeded ? `Remove ${item} from shopping list` : `Add ${item} to shopping list`}
                            className={`w-6 h-6 rounded-full text-sm leading-none flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 ${
                              isNeeded
                                ? "bg-gold text-white"
                                : "bg-surface-warm text-ink-light hover:bg-gold-light"
                            }`}
                          >
                            {isNeeded ? "✓" : "+"}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            aria-label={`Remove ${item} from Core Pantry`}
                            onClick={() => removeCatalog(catalogKey)}
                            className="hidden md:inline-flex items-center justify-center text-ink-light hover:text-red text-xs font-mono px-1 flex-shrink-0 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>
              </Collapsible>
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

      {otherCoreNames.length > 0 && (
        <Collapsible
          title="Other Core Ingredients"
          subtitle="Core ingredients this week's recipes use that aren't in the catalog above — set an on-hand amount so the Shopping List can skip them when you have enough."
        >
          <div className="flex flex-col gap-1.5">
            {otherCoreNames.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2"
              >
                <span className="flex-1 text-sm min-w-0">{name}</span>
                <OnHandControl ingredientName={name} initial={onHandByName.get(name.trim().toLowerCase())} />
              </div>
            ))}
          </div>
        </Collapsible>
      )}

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
              <SwipeableRow
                key={staple.id}
                disabled={isPending}
                deleteLabel={`Delete ${staple.label}`}
                onDelete={() =>
                  startTransition(() => {
                    deleteStaple(staple.id);
                  })
                }
              >
                <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm min-w-0">
                    {staple.label}
                    {staple.quantity && <span className="text-ink-light text-xs"> — {staple.quantity}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggle(neededKey)}
                    aria-label={isNeeded ? `Remove ${staple.label} from shopping list` : `Add ${staple.label} to shopping list`}
                    className={`w-6 h-6 rounded-full text-sm leading-none flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 ${
                      isNeeded
                        ? "bg-gold text-white"
                        : "bg-surface-warm text-ink-light hover:bg-gold-light"
                    }`}
                  >
                    {isNeeded ? "✓" : "+"}
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
                    className="hidden md:inline-flex items-center justify-center text-ink-light hover:text-ink text-xs font-mono px-1 flex-shrink-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </SwipeableRow>
            );
          })}
          {staples.length === 0 && (
            <p className="text-xs text-ink-light">
              No staples added yet — use the + button above for things like
              Nutella or pretzel sticks that you always keep stocked.
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
