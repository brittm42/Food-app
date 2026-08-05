"use client";

import { useState, useTransition } from "react";
import { deletePantryItem, createPantryItem, flagPantryItemNeeded, markPantryItemInStock } from "@/app/actions/pantry";
import { UNIT_OPTIONS } from "@/lib/units";
import { CATEGORIES, sectionForCategory, type Section } from "@/lib/categories";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";
import SwipeableRow from "@/components/SwipeableRow";
import PantryItemSheet from "@/components/PantryItemSheet";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  target_qty: number | null;
  target_unit: string | null;
  note: string | null;
  in_stock: boolean;
};

type Need = { value: number | null; unit: string | null };

const TABS: { id: Section; label: string; subtitle: string }[] = [
  { id: "fresh", label: "Fresh", subtitle: "Perishables — just in stock or not. Flag it when you need more." },
  { id: "pantry", label: "Pantry", subtitle: "Shelf-stable — just in stock or not. Flag it when you need more." },
  { id: "household", label: "Household", subtitle: "Cleaning, paper goods, and everything else non-food." },
];

function stockLine(item: PantryItem): string | null {
  const parts: string[] = [];
  if (item.target_qty != null) parts.push(`usually ${item.target_qty}${item.target_unit ? ` ${item.target_unit}` : ""}`);
  if (item.note) parts.push(item.note);
  return parts.length ? parts.join(" — ") : null;
}

// Whichever is bigger — the usual amount to buy, or this week's computed
// recipe need (Britt's call: better to over-buy slightly than come up
// short on a recipe). Only comparable when the units actually match;
// otherwise the recipe-computed figure wins since it's the more specific,
// time-sensitive number.
function defaultRestockQty(item: PantryItem, needed: Need | undefined): { value: number | null; unit: string | null } {
  if (needed?.value != null) {
    if (item.target_qty != null && item.target_unit === needed.unit && item.target_qty >= needed.value) {
      return { value: item.target_qty, unit: item.target_unit };
    }
    return { value: needed.value, unit: needed.unit };
  }
  return { value: item.target_qty, unit: item.target_unit };
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

function HomeStockItemRow({ item, needed, isPending }: { item: PantryItem; needed: Need | undefined; isPending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [rowPending, startTransition] = useTransition();
  const line = stockLine(item);
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
            {needed?.value != null && (
              <span className="block text-teal text-xs">
                Need ~{needed.value}
                {needed.unit ? ` ${needed.unit}` : ""} this week
              </span>
            )}
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
      {editing && <PantryItemSheet item={item} onClose={() => setEditing(false)} />}
      {flagging && <FlagNeededSheet item={item} needed={needed} onClose={() => setFlagging(false)} />}
    </>
  );
}

// Small prompt shown when flagging an item as needed — the quantity is
// specified right then, defaulting to whichever is bigger: the usual
// amount or this week's computed recipe need (see defaultRestockQty).
function FlagNeededSheet({ item, needed, onClose }: { item: PantryItem; needed: Need | undefined; onClose: () => void }) {
  const suggested = defaultRestockQty(item, needed);
  const [value, setValue] = useState(suggested.value != null ? String(suggested.value) : "");
  const [unit, setUnit] = useState(suggested.unit ?? "");
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
      triggerAriaLabel="Add an item to Home Stock"
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
          placeholder="Usual amount to buy (optional)"
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
      <p className="text-[11px] text-ink-light">It&apos;ll be sorted into Fresh, Pantry, or Household automatically.</p>
    </QuickAddModal>
  );
}

export default function KitchenView({ items, needed }: { items: PantryItem[]; needed: Record<string, Need> }) {
  const [isPending] = useTransition();
  const [tab, setTab] = useState<Section>("fresh");

  const itemsBySection: Record<Section, PantryItem[]> = { fresh: [], pantry: [], household: [] };
  for (const item of items) itemsBySection[sectionForCategory(item.category)].push(item);

  const activeTab = TABS.find((t) => t.id === tab)!;
  const activeItems = itemsBySection[tab];
  const groups = groupByCategory(activeItems);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">Home Stock</h1>
        <AddKitchenItemButton />
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === t.id ? "text-teal border-teal" : "text-ink-light border-transparent hover:text-ink-mid"
            }`}
          >
            {t.label}
            {itemsBySection[t.id].length > 0 && (
              <span className="ml-1 text-ink-light">{itemsBySection[t.id].length}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-light -mt-3">{activeTab.subtitle}</p>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <Collapsible key={group.category} title={group.category}>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <HomeStockItemRow key={item.id} item={item} needed={needed[item.id]} isPending={isPending} />
              ))}
            </div>
          </Collapsible>
        ))}
        {activeItems.length === 0 && <p className="text-xs text-ink-light">No {activeTab.label} items yet.</p>}
      </div>
    </div>
  );
}
