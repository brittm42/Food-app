"use client";

import { useState, useTransition } from "react";
import { deletePantryItem, createPantryItem, addPantryItemToShoppingList } from "@/app/actions/pantry";
import { setPantryOnHand } from "@/app/actions/pantry-on-hand";
import { UNIT_OPTIONS } from "@/lib/units";
import { CATEGORIES } from "@/lib/categories";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";
import SwipeableRow from "@/components/SwipeableRow";
import PantryItemSheet from "@/components/PantryItemSheet";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  item_type: "core" | "weekly_fresh" | "staple";
  on_hand_qty: number | null;
  on_hand_unit: string | null;
  target_qty: number | null;
  target_unit: string | null;
  note: string | null;
};

type OnHandRow = { ingredient_name: string; quantity_value: number | null; quantity_unit: string | null };

function stockLine(item: PantryItem): string | null {
  const parts: string[] = [];
  if (item.item_type === "weekly_fresh") {
    if (item.target_qty != null) parts.push(`usually ${item.target_qty}${item.target_unit ? ` ${item.target_unit}` : ""}`);
  } else {
    const { on_hand_qty: onHand, target_qty: target, on_hand_unit: onHandUnit, target_unit: targetUnit } = item;
    if (onHand != null && target != null) {
      parts.push(`${onHand} of ${target}${targetUnit ? ` ${targetUnit}` : ""}`);
    } else if (onHand != null) {
      parts.push(`have ${onHand}${onHandUnit ? ` ${onHandUnit}` : ""}`);
    } else if (target != null) {
      parts.push(`target ${target}${targetUnit ? ` ${targetUnit}` : ""}`);
    }
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

function PantryItemRow({ item, isPending }: { item: PantryItem; isPending: boolean }) {
  const [editing, setEditing] = useState(false);
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
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              startTransition(() => {
                addPantryItemToShoppingList(item.id);
              })
            }
            aria-label={`Add ${item.name} to shopping list`}
            className="w-6 h-6 rounded-full text-sm leading-none flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50 bg-surface-warm text-ink-light hover:bg-gold-light"
          >
            +
          </button>
        </div>
      </SwipeableRow>
      {editing && <PantryItemSheet item={item} onClose={() => setEditing(false)} />}
    </>
  );
}

function OnHandControl({ ingredientName, initial }: { ingredientName: string; initial: OnHandRow | undefined }) {
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
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(() => {
      createPantryItem(trimmed, qty.trim() ? Number(qty) : null, unit || null, null, null);
    });
    setName("");
    setQty("");
    setUnit("");
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Nutella, pretzel sticks…"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty on hand (optional)"
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
    </QuickAddModal>
  );
}

export default function PantryView({
  items,
  otherCoreNames,
  otherCoreOnHand,
}: {
  items: PantryItem[];
  otherCoreNames: string[];
  otherCoreOnHand: OnHandRow[];
}) {
  const [isPending] = useTransition();
  const onHandByName = new Map(otherCoreOnHand.map((row) => [row.ingredient_name, row]));

  const core = items.filter((i) => i.item_type === "core");
  const weeklyFresh = items.filter((i) => i.item_type === "weekly_fresh");
  const staples = items.filter((i) => i.item_type === "staple");

  const coreByCategory = groupByCategory(core);
  const stapleByCategory = groupByCategory(staples);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-light">Pantry</h1>
        <AddStapleButton />
      </div>

      <Collapsible title="Core Pantry" subtitle="If this is stocked, you can always make something.">
        <div className="flex flex-col gap-5">
          {coreByCategory.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <PantryItemRow key={item.id} item={item} isPending={isPending} />
                ))}
              </div>
            </Collapsible>
          ))}
          {core.length === 0 && <p className="text-xs text-ink-light">No Core Pantry items yet.</p>}
        </div>
      </Collapsible>

      {otherCoreNames.length > 0 && (
        <Collapsible
          title="Other Core Ingredients"
          subtitle="Core ingredients this week's recipes use that aren't in the catalog above — set an on-hand amount so the Shopping List can skip them when you have enough."
        >
          <div className="flex flex-col gap-1.5">
            {otherCoreNames.map((name) => (
              <div key={name} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                <span className="flex-1 text-sm min-w-0">{name}</span>
                <OnHandControl ingredientName={name} initial={onHandByName.get(name.trim().toLowerCase())} />
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      <Collapsible title="Weekly Fresh">
        <div className="flex flex-col gap-1.5">
          {weeklyFresh.map((item) => (
            <PantryItemRow key={item.id} item={item} isPending={isPending} />
          ))}
          {weeklyFresh.length === 0 && <p className="text-xs text-ink-light">No Weekly Fresh items yet.</p>}
        </div>
      </Collapsible>

      <Collapsible title="My Staples">
        <div className="flex flex-col gap-5">
          {stapleByCategory.map((group) => (
            <Collapsible key={group.category} title={group.category}>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <PantryItemRow key={item.id} item={item} isPending={isPending} />
                ))}
              </div>
            </Collapsible>
          ))}
          {staples.length === 0 && (
            <p className="text-xs text-ink-light">
              No staples added yet — use the + button above for things like Nutella or pretzel sticks that you
              always keep stocked.
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
