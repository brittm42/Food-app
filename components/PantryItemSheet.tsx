"use client";

import { useState, useTransition } from "react";
import { UNIT_OPTIONS } from "@/lib/units";
import { updatePantryOnHand, updatePantryTarget, updatePantryNote } from "@/app/actions/pantry";

// Tap-to-edit bottom sheet for a Kitchen item: a Pantry-category item's
// on-hand + target quantities, or a Fresh-category item's single "usual
// amount to buy" target — plus a freeform note (brand/store preference,
// dietary note) either way. Replaces the old cramped inline number input +
// unit <select> pair (OnHandControl) that lived directly in the list row.
export default function PantryItemSheet({
  item,
  fresh,
  onClose,
}: {
  item: {
    id: string;
    name: string;
    on_hand_qty: number | null;
    on_hand_unit: string | null;
    target_qty: number | null;
    target_unit: string | null;
    note: string | null;
  };
  fresh: boolean;
  onClose: () => void;
}) {
  const [onHandValue, setOnHandValue] = useState(item.on_hand_qty != null ? String(item.on_hand_qty) : "");
  const [onHandUnit, setOnHandUnit] = useState(item.on_hand_unit ?? "");
  const [targetValue, setTargetValue] = useState(item.target_qty != null ? String(item.target_qty) : "");
  const [targetUnit, setTargetUnit] = useState(item.target_unit ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [isPending, startTransition] = useTransition();

  const showOnHand = !fresh;
  const targetLabel = fresh ? "Usual amount to buy" : "Target (restock to)";

  function save() {
    const nextOnHandValue = onHandValue.trim() ? Number(onHandValue) : null;
    const nextTargetValue = targetValue.trim() ? Number(targetValue) : null;
    startTransition(async () => {
      if (showOnHand) await updatePantryOnHand(item.id, nextOnHandValue, onHandUnit || null);
      await updatePantryTarget(item.id, nextTargetValue, targetUnit || null);
      if (note !== (item.note ?? "")) await updatePantryNote(item.id, note || null);
      onClose();
    });
  }

  return (
    <div className="fixed inset-x-0 top-0 h-dvh bg-ink/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-xs flex flex-col gap-4"
      >
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-light">{item.name}</div>

        {showOnHand && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-ink-light">On hand</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={onHandValue}
                onChange={(e) => setOnHandValue(e.target.value)}
                placeholder="qty"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
              />
              <select
                value={onHandUnit}
                onChange={(e) => setOnHandUnit(e.target.value)}
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
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">{targetLabel}</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="qty"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
            />
            <select
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
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
