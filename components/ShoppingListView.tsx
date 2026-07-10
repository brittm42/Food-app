"use client";

import { useRef, useState, useTransition } from "react";
import { toggleChecked } from "@/app/actions/pantry";
import { toggleCoreItemChecked } from "@/app/actions/pantry-on-hand";
import { addShoppingItem, removeShoppingItem } from "@/app/actions/shopping";
import { UNIT_OPTIONS } from "@/lib/units";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";

// neededValue/neededUnit are only ever populated on Core-section items
// (the seam that already computes a per-ingredient needed quantity for
// reconciliation, app/shopping/page.tsx) — undefined for Fresh, which has
// no such concept and just uses the plain toggle.
type Item = {
  key: string;
  label: string;
  checked: boolean;
  neededValue?: number | null;
  neededUnit?: string | null;
};
type CategoryGroup<T> = { category: string; items: T[] };
type ShoppingItem = { id: string; label: string; category: string; quantityValue: number | null; quantityUnit: string | null };

export default function ShoppingListView({
  fresh,
  core,
  items,
  hasQueue,
}: {
  fresh: Item[];
  core: CategoryGroup<Item>[];
  items: CategoryGroup<ShoppingItem>[];
  hasQueue: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [removedItem, setRemovedItem] = useState<ShoppingItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(item: Item) {
    startTransition(() => {
      toggleChecked(item.key);
    });
  }

  // Core items have a computed needed quantity (this week's queued
  // recipes) — checking one on/off also adjusts on-hand by that amount.
  // Fresh has no such concept, so it uses the plain toggle above.
  function toggleCore(item: Item) {
    startTransition(() => {
      toggleCoreItemChecked(item.key, item.label, item.neededValue ?? null, item.neededUnit ?? null);
    });
  }

  // Every shopping_items row (one-off adds, Pantry restock/add-to-list
  // taps) is a hard delete — there's no toggle to flip back. Hold onto what
  // was just removed for a few seconds so an accidental tap is recoverable
  // via the Undo banner below.
  function checkOffItem(item: ShoppingItem) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemovedItem(item);
    undoTimer.current = setTimeout(() => setRemovedItem(null), 5000);
    startTransition(() => {
      removeShoppingItem(item.id);
    });
  }

  function undoRemove() {
    if (!removedItem) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    startTransition(() => {
      addShoppingItem(removedItem.label, removedItem.quantityValue, removedItem.quantityUnit);
    });
    setRemovedItem(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">Shopping List</h1>
        <AddOneOffButton />
      </div>

      {!hasQueue && (
        <p className="text-sm text-ink-light text-center py-4">
          Nothing queued in This Week yet — add meals there and their
          ingredients will show up here.
        </p>
      )}

      {fresh.length > 0 && (
        <Collapsible title="Buy Fresh">
          <ChecklistSection items={fresh} onToggle={toggle} disabled={isPending} />
        </Collapsible>
      )}
      {core.length > 0 && (
        <Collapsible title="Check Core Pantry">
          <div className="flex flex-col gap-4">
            {core.map((group) => (
              <Collapsible key={group.category} title={group.category}>
                <ChecklistSection items={group.items} onToggle={toggleCore} disabled={isPending} />
              </Collapsible>
            ))}
          </div>
        </Collapsible>
      )}

      {removedItem && (
        <div className="flex items-center justify-between bg-ink text-white rounded-lg px-3 py-2 text-sm">
          <span>Removed &ldquo;{removedItem.label}&rdquo;</span>
          <button
            type="button"
            onClick={undoRemove}
            className="font-mono text-[11px] uppercase tracking-wide text-teal-mid cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-ink-light">
          Nothing on your list — use the + button above to add something, or tap the + on a Pantry item to restock it.
        </p>
      )}
      {items.map((group) => (
        <Collapsible key={group.category} title={group.category}>
          <div className="flex flex-col gap-1.5">
            {group.items.map((item) => (
              <ShoppingItemRow key={item.id} item={item} onCheckOff={checkOffItem} disabled={isPending} />
            ))}
          </div>
        </Collapsible>
      ))}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onCheckOff,
  disabled,
}: {
  item: ShoppingItem;
  onCheckOff: (item: ShoppingItem) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={false}
        disabled={disabled}
        onChange={() => onCheckOff(item)}
        className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
      />
      <span className="text-sm">
        {item.label}
        {item.quantityValue != null && (
          <span className="text-ink-light text-xs">
            {" "}
            — {item.quantityValue}
            {item.quantityUnit ? ` ${item.quantityUnit}` : ""}
          </span>
        )}
      </span>
    </label>
  );
}

function AddOneOffButton() {
  const [value, setValue] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(() => {
      addShoppingItem(trimmed, qty.trim() ? Number(qty) : null, unit || null);
    });
    setValue("");
    setQty("");
    setUnit("");
    close();
  }

  return (
    <QuickAddModal
      triggerAriaLabel="Add an item to the Shopping List"
      headerLabel="Add to Shopping List"
      submitDisabled={isPending}
      onSubmit={submit}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. paper towels"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity (optional)"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="border border-border rounded-lg px-2 py-2 text-base bg-surface focus:outline-none focus:border-teal"
        >
          <option value="">unit</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.value}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-ink-light">
        It&apos;ll be sorted into the right aisle section automatically.
      </p>
    </QuickAddModal>
  );
}

function ChecklistSection({
  items,
  onToggle,
  disabled,
}: {
  items: Item[];
  onToggle: (item: Item) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <label
          key={item.key}
          className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={item.checked}
            disabled={disabled}
            onChange={() => onToggle(item)}
            className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
          />
          <span className={`text-sm ${item.checked ? "line-through text-ink-light" : ""}`}>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
