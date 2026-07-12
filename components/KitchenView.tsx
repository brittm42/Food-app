"use client";

import { useState, useTransition } from "react";
import {
  deletePantryItem,
  createPantryItem,
  addPantryItemToShoppingList,
  removePantryItemFromShoppingList,
  flagPantryItemNeeded,
  markPantryItemInStock,
} from "@/app/actions/pantry";
import { UNIT_OPTIONS } from "@/lib/units";
import { CATEGORIES, isFreshCategory } from "@/lib/categories";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";
import SwipeableRow from "@/components/SwipeableRow";
import PantryItemSheet from "@/components/PantryItemSheet";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  on_hand_qty: number | null;
  on_hand_unit: string | null;
  target_qty: number | null;
  target_unit: string | null;
  note: string | null;
  in_stock: boolean;
};

function stockLine(item: PantryItem, fresh: boolean): string | null {
  const parts: string[] = [];
  if (fresh) {
    if (item.target_qty != null) parts.push(`usually ${item.target_qty}${item.target_unit ? ` ${item.target_unit}` : ""}`);
  } else if (item.on_hand_qty != null && item.target_qty != null) {
    parts.push(`${item.on_hand_qty} of ${item.target_qty}${item.target_unit ? ` ${item.target_unit}` : ""}`);
  } else if (item.on_hand_qty != null) {
    parts.push(`have ${item.on_hand_qty}${item.on_hand_unit ? ` ${item.on_hand_unit}` : ""}`);
  } else if (item.target_qty != null) {
    parts.push(`target ${item.target_qty}${item.target_unit ? ` ${item.target_unit}` : ""}`);
  }
  if (item.note) parts.push(item.note);
  return parts.length ? parts.join(" — ") : null;
}

function groupByCategory(items: PantryItem[]) {
  const byCategory = new Map<string, PantryItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }
  return CATEGORIES.filter((c) => byCategory.has(c)).map((category) => ({
    category,
    items: byCategory.get(category)!,
  }));
}

function PantryItemRow({ item, isPending, onList }: { item: PantryItem; isPending: boolean; onList: boolean }) {
  const [editing, setEditing] = useState(false);
  const [rowPending, startTransition] = useTransition();
  const line = stockLine(item, false);
  const disabled = isPending || rowPending;

  return (
    <>
      <SwipeableRow disabled={disabled} deleteLabel={`Delete ${item.name}`} onDelete={() => deletePantryItem(item.id)}>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm min-w-0 cursor-pointer"
          >
            {item.name}
            {line && <span className="text-ink-light text-xs"> — {line}</span>}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              startTransition(() => {
                if (onList) {
                  removePantryItemFromShoppingList(item.id);
                } else {
                  addPantryItemToShoppingList(item.id);
                }
              })
            }
            aria-label={onList ? `Remove ${item.name} from shopping list` : `Add ${item.name} to shopping list`}
            className={`w-6 h-6 rounded-full text-sm leading-none flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 ${
              onList
                ? "bg-gold text-white"
                : "border border-border text-ink-light hover:border-gold hover:bg-gold-light"
            }`}
          >
            {onList ? "✓" : "+"}
          </button>
        </div>
      </SwipeableRow>
      {editing && <PantryItemSheet item={item} fresh={false} onClose={() => setEditing(false)} />}
    </>
  );
}

function FreshItemRow({ item, isPending }: { item: PantryItem; isPending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [rowPending, startTransition] = useTransition();
  const line = stockLine(item, true);
  const disabled = isPending || rowPending;

  return (
    <>
      <SwipeableRow disabled={disabled} deleteLabel={`Delete ${item.name}`} onDelete={() => deletePantryItem(item.id)}>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm min-w-0 cursor-pointer"
          >
            {item.name}
            {line && <span className="text-ink-light text-xs"> — {line}</span>}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (item.in_stock) {
                setFlagging(true);
              } else {
                startTransition(() => {
                  markPantryItemInStock(item.id);
                });
              }
            }}
            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors disabled:opacity-50 ${
              item.in_stock
                ? "border border-border text-ink-light hover:border-gold hover:bg-gold-light"
                : "bg-gold-light text-ink"
            }`}
          >
            {item.in_stock ? "In stock" : "Need to buy"}
          </button>
        </div>
      </SwipeableRow>
      {editing && <PantryItemSheet item={item} fresh onClose={() => setEditing(false)} />}
      {flagging && <FlagNeededSheet item={item} onClose={() => setFlagging(false)} />}
    </>
  );
}

// Small prompt shown when flipping a Fresh item from "in stock" to "need to
// buy" — the quantity is specified right then (defaulting to the item's
// usual amount, overridable), rather than reusing whatever was last stored.
function FlagNeededSheet({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const [value, setValue] = useState(item.target_qty != null ? String(item.target_qty) : "");
  const [unit, setUnit] = useState(item.target_unit ?? "");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const qtyValue = value.trim() ? Number(value) : null;
    startTransition(async () => {
      await flagPantryItemNeeded(item.id, qtyValue, unit || null);
      onClose();
    });
  }

  return (
    <div className="fixed inset-x-0 top-0 h-dvh bg-ink/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-xs flex flex-col gap-4"
      >
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">How many {item.name}?</div>
        <div className="flex gap-2">
          <input
            autoFocus
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
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-ink-light text-sm px-3 py-2 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={submit}
            className="bg-ink text-white rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            Add to Shopping List
          </button>
        </div>
      </div>
    </div>
  );
}

function AddKitchenItemButton() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(() => {
      createPantryItem(trimmed, qty.trim() ? Number(qty) : null, unit || null, note || null);
    });
    setName("");
    setQty("");
    setUnit("");
    setNote("");
    close();
  }

  return (
    <QuickAddModal
      triggerAriaLabel="Add an item to My Kitchen"
      headerLabel="Add an item"
      submitDisabled={isPending}
      onSubmit={submit}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Nutella, pretzel sticks, garlic…"
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
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (brand, store, dietary…) — optional"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
      <p className="text-[11px] text-ink-light">It&apos;ll be sorted into Fresh or Pantry automatically.</p>
    </QuickAddModal>
  );
}

export default function KitchenView({
  items,
  onShoppingListIds,
}: {
  items: PantryItem[];
  onShoppingListIds: string[];
}) {
  const [isPending] = useTransition();
  const onListSet = new Set(onShoppingListIds);

  const freshItems = items.filter((i) => isFreshCategory(i.category));
  const pantryItems = items.filter((i) => !isFreshCategory(i.category));
  const freshByCategory = groupByCategory(freshItems);
  const pantryByCategory = groupByCategory(pantryItems);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">My Kitchen</h1>
        <AddKitchenItemButton />
      </div>

      <Collapsible level="section" title="Fresh" subtitle="Perishables — just in stock or not. Flag it when you need more.">
        <div className="flex flex-col gap-5">
          {freshByCategory.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <FreshItemRow key={item.id} item={item} isPending={isPending} />
                ))}
              </div>
            </Collapsible>
          ))}
          {freshItems.length === 0 && <p className="text-xs text-ink-light">No Fresh items yet.</p>}
        </div>
      </Collapsible>

      <Collapsible level="section" title="Pantry" subtitle="Shelf-stable — tracked on-hand vs. target.">
        <div className="flex flex-col gap-5">
          {pantryByCategory.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <PantryItemRow key={item.id} item={item} isPending={isPending} onList={onListSet.has(item.id)} />
                ))}
              </div>
            </Collapsible>
          ))}
          {pantryItems.length === 0 && <p className="text-xs text-ink-light">No Pantry items yet.</p>}
        </div>
      </Collapsible>
    </div>
  );
}
