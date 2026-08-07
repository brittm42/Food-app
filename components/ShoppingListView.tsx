"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toggleChecked } from "@/app/actions/pantry";
import { addShoppingItem, removeShoppingItem, updateShoppingItem } from "@/app/actions/shopping";
import { markOrderPickedUp } from "@/app/actions/kroger-send";
import { UNIT_OPTIONS } from "@/lib/units";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";

type ChecklistItem = { key: string; label: string; checked: boolean };
type ShoppingItem = {
  id: string;
  label: string;
  category: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  note: string | null;
  recipeDriven: boolean;
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
  // Items mid-checkoff: shown checked + greyed in place, not yet deleted.
  // A second tap within the window cancels the pending removal and restores
  // the item to normal; letting the timer run out actually removes it.
  const [pendingRemoval, setPendingRemoval] = useState<Record<string, boolean>>({});
  const removalTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = removalTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  function toggle(item: ChecklistItem) {
    startTransition(() => {
      toggleChecked(item.key);
    });
  }

  // Tapping the checkbox marks the item checked + greyed right where it is —
  // no delete yet. A second tap within 5s cancels the pending removal and
  // restores it to a normal unchecked row. If the window elapses untouched,
  // the row is actually removed from shopping_items.
  function toggleCheckOff(item: ShoppingItem) {
    if (pendingRemoval[item.id]) {
      clearTimeout(removalTimers.current[item.id]);
      delete removalTimers.current[item.id];
      setPendingRemoval((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    setPendingRemoval((prev) => ({ ...prev, [item.id]: true }));
    removalTimers.current[item.id] = setTimeout(() => {
      delete removalTimers.current[item.id];
      setPendingRemoval((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      startTransition(() => {
        removeShoppingItem(item.id);
      });
    }, 5000);
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
              className="flex-1 sm:flex-none sm:w-64 flex items-center justify-center gap-1.5 text-center bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium"
            >
              <span aria-hidden="true">🛒</span> Add to my cart
            </Link>
          )}
          {hasSentItems && (
            <button
              type="button"
              onClick={handlePickedUp}
              disabled={isPending}
              className="flex-1 sm:flex-none sm:w-64 border border-border rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              Mark order picked up
            </button>
          )}
        </div>
      )}

      {!hasQueue && (
        <p className="text-sm text-ink-light text-center py-4">
          Pro tip: add recipes to{" "}
          <Link href="/this-week" className="text-teal underline">
            This Week
          </Link>{" "}
          to auto-populate your shopping list with ingredients you don&apos;t typically stock.
        </p>
      )}

      <Collapsible level="section" title="Fresh">
        <div className="flex flex-col gap-4">
          {fresh.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                <ChecklistSection items={group.checklist} onToggle={toggle} disabled={isPending} />
                {group.shoppingItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    checked={!!pendingRemoval[item.id]}
                    onCheckOff={toggleCheckOff}
                    disabled={isPending}
                  />
                ))}
              </div>
            </Collapsible>
          ))}
          {!hasFresh && <p className="text-xs text-ink-light">Nothing fresh needed right now.</p>}
        </div>
      </Collapsible>

      <Collapsible level="section" title="Pantry">
        <div className="flex flex-col gap-4">
          {pantry.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                {group.shoppingItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    checked={!!pendingRemoval[item.id]}
                    onCheckOff={toggleCheckOff}
                    disabled={isPending}
                  />
                ))}
              </div>
            </Collapsible>
          ))}
          {!hasPantry && (
            <p className="text-xs text-ink-light">
              Nothing on your list — use the + button above to add something, or tap &ldquo;Need to buy&rdquo; on a Home Stock item to restock it.
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

function ShoppingItemRow({
  item,
  checked,
  onCheckOff,
  disabled,
}: {
  item: ShoppingItem;
  checked: boolean;
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
          checked={checked}
          disabled={disabled}
          onChange={() => onCheckOff(item)}
          className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
        />
        <button
          type="button"
          onClick={() => !checked && setEditing(true)}
          disabled={checked}
          className={`flex-1 text-left text-sm min-w-0 ${checked ? "text-ink-light line-through" : "cursor-pointer"}`}
        >
          {item.recipeDriven && !checked && (
            <span className="font-mono text-[9px] uppercase tracking-wide text-teal border border-teal rounded-full px-1.5 py-0.5 mr-1.5 align-middle">
              This week
            </span>
          )}
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
  const [label, setLabel] = useState(item.label);
  const [value, setValue] = useState(item.quantityValue != null ? String(item.quantityValue) : "");
  const [unit, setUnit] = useState(item.quantityUnit ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    const qtyValue = value.trim() ? Number(value) : null;
    startTransition(async () => {
      await updateShoppingItem(item.id, label, qtyValue, unit || null, note || null);
      onClose();
    });
  }

  return (
    <div className="fixed inset-x-0 top-0 h-dvh bg-ink/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-xs flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">Name</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
          />
        </div>

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
            disabled={isPending || !label.trim()}
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
