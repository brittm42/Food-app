"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toggleChecked } from "@/app/actions/pantry";
import { toggleCoreItemChecked } from "@/app/actions/pantry-on-hand";
import { addShoppingItem, removeShoppingItem, updateShoppingItem } from "@/app/actions/shopping";
import { markOrderPickedUp } from "@/app/actions/kroger-send";
import { UNIT_OPTIONS } from "@/lib/units";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";

type ChecklistItem = {
  key: string;
  label: string;
  checked: boolean;
  neededValue?: number | null;
  neededUnit?: string | null;
};
type ShoppingItem = {
  id: string;
  label: string;
  category: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  note: string | null;
  sentAt: string | null;
  krogerProductDescription: string | null;
  krogerQuantity: number | null;
};
type CategoryGroup = { category: string; checklist: ChecklistItem[]; shoppingItems: ShoppingItem[] };

export default function ShoppingListView({
  fresh,
  pantry,
  hasQueue,
  krogerConnected,
  hasEligibleItems,
  hasSentItems,
}: {
  fresh: CategoryGroup[];
  pantry: CategoryGroup[];
  hasQueue: boolean;
  krogerConnected: boolean;
  hasEligibleItems: boolean;
  hasSentItems: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [removedItem, setRemovedItem] = useState<ShoppingItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(item: ChecklistItem) {
    startTransition(() => {
      toggleChecked(item.key);
    });
  }

  // Pantry-section checklist entries have a computed needed quantity (this
  // week's queued recipes) — checking one on/off also adjusts on-hand by
  // that amount. Fresh checklist entries have no such concept, so they use
  // the plain toggle above.
  function toggleCore(item: ChecklistItem) {
    startTransition(() => {
      toggleCoreItemChecked(item.key, item.label, item.neededValue ?? null, item.neededUnit ?? null);
    });
  }

  // Every shopping_items row (one-off adds, Kitchen restock/flag taps) is a
  // hard delete — there's no toggle to flip back. Hold onto what was just
  // removed for a few seconds so an accidental tap is recoverable via the
  // Undo banner below.
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
      addShoppingItem(removedItem.label, removedItem.quantityValue, removedItem.quantityUnit, removedItem.note);
    });
    setRemovedItem(null);
  }

  function handlePickedUp() {
    startTransition(() => {
      markOrderPickedUp();
    });
  }

  const hasFresh = fresh.some((g) => g.checklist.length || g.shoppingItems.length);
  const hasPantry = pantry.some((g) => g.checklist.length || g.shoppingItems.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">Shopping List</h1>
        <AddOneOffButton />
      </div>

      {(hasEligibleItems || hasSentItems) && (
        <div className="flex gap-2">
          {hasEligibleItems && (
            <Link
              href={krogerConnected ? "/shopping/send-to-kroger" : "/api/kroger/connect?returnTo=/shopping/send-to-kroger"}
              className="flex-1 text-center bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium"
            >
              Send to Kroger
            </Link>
          )}
          {hasSentItems && (
            <button
              type="button"
              onClick={handlePickedUp}
              disabled={isPending}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              Mark order picked up
            </button>
          )}
        </div>
      )}

      {!hasQueue && (
        <p className="text-sm text-ink-light text-center py-4">
          Nothing queued in This Week yet — add meals there and their
          ingredients will show up here.
        </p>
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

      <Collapsible title="Fresh">
        <div className="flex flex-col gap-4">
          {fresh.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                <ChecklistSection items={group.checklist} onToggle={toggle} disabled={isPending} />
                {group.shoppingItems.map((item) => (
                  <ShoppingItemRow key={item.id} item={item} onCheckOff={checkOffItem} disabled={isPending} />
                ))}
              </div>
            </Collapsible>
          ))}
          {!hasFresh && <p className="text-xs text-ink-light">Nothing fresh needed right now.</p>}
        </div>
      </Collapsible>

      <Collapsible title="Pantry">
        <div className="flex flex-col gap-4">
          {pantry.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                <ChecklistSection items={group.checklist} onToggle={toggleCore} disabled={isPending} />
                {group.shoppingItems.map((item) => (
                  <ShoppingItemRow key={item.id} item={item} onCheckOff={checkOffItem} disabled={isPending} />
                ))}
              </div>
            </Collapsible>
          ))}
          {!hasPantry && (
            <p className="text-xs text-ink-light">
              Nothing on your list — use the + button above to add something, or tap &ldquo;Need to buy&rdquo; on a Kitchen item to restock it.
            </p>
          )}
        </div>
      </Collapsible>
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
  const [editing, setEditing] = useState(false);

  // Sent-to-Kroger rows aren't checked/edited like a normal item — they're
  // awaiting real-world pickup, not a tap. "Mark order picked up" (the
  // header button) is what completes them, all at once.
  if (item.sentAt) {
    return (
      <div className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 opacity-70">
        <span className="font-mono text-[9px] uppercase tracking-wide text-teal border border-teal rounded-full px-1.5 py-0.5 flex-shrink-0">
          Sent
        </span>
        <span className="flex-1 text-left text-sm min-w-0">
          {item.krogerProductDescription ?? item.label}
          {item.krogerQuantity != null && (
            <span className="text-ink-light text-xs"> — qty {item.krogerQuantity}</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2">
        <input
          type="checkbox"
          checked={false}
          disabled={disabled}
          onChange={() => onCheckOff(item)}
          className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
        />
        <button type="button" onClick={() => setEditing(true)} className="flex-1 text-left text-sm min-w-0 cursor-pointer">
          {item.label}
          {item.quantityValue != null && (
            <span className="text-ink-light text-xs">
              {" "}
              — {item.quantityValue}
              {item.quantityUnit ? ` ${item.quantityUnit}` : ""}
            </span>
          )}
          {item.note && <span className="text-ink-light text-xs"> — {item.note}</span>}
        </button>
      </div>
      {editing && <ShoppingItemSheet item={item} onClose={() => setEditing(false)} />}
    </>
  );
}

// Tap-to-edit bottom sheet for a Shopping List item's quantity/unit/note —
// same pattern as Kitchen's PantryItemSheet, closing the gap where one-off
// items could only get a quantity/unit at creation, never afterward.
function ShoppingItemSheet({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const [value, setValue] = useState(item.quantityValue != null ? String(item.quantityValue) : "");
  const [unit, setUnit] = useState(item.quantityUnit ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    const qtyValue = value.trim() ? Number(value) : null;
    startTransition(async () => {
      await updateShoppingItem(item.id, qtyValue, unit || null, note || null);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-xs flex flex-col gap-4"
      >
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">{item.label}</div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">Quantity</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="qty"
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
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">Note (brand, store, dietary…)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Kroger brand, the big bag"
            className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-ink-light text-sm px-3 py-2 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
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
  items: ChecklistItem[];
  onToggle: (item: ChecklistItem) => void;
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
