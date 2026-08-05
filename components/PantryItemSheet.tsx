"use client";

import { useState, useTransition } from "react";
import { UNIT_OPTIONS } from "@/lib/units";
import { updatePantryTarget, updatePantryNote, updatePantryItemName } from "@/app/actions/pantry";

// Tap-to-edit bottom sheet for a Home Stock item: name, its "usual amount
// to buy" (the default quantity used whenever it's flagged as needed), and
// a freeform note (brand/store preference, dietary note). Every item —
// Fresh, Pantry, or Household — uses the same binary in-stock model now, so
// there's no separate on-hand quantity to edit here.
export default function PantryItemSheet({
  item,
  onClose,
}: {
  item: {
    id: string;
    name: string;
    target_qty: number | null;
    target_unit: string | null;
    note: string | null;
  };
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [targetValue, setTargetValue] = useState(item.target_qty != null ? String(item.target_qty) : "");
  const [targetUnit, setTargetUnit] = useState(item.target_unit ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    const nextTargetValue = targetValue.trim() ? Number(targetValue) : null;
    const trimmedName = name.trim();
    startTransition(async () => {
      if (trimmedName && trimmedName !== item.name) await updatePantryItemName(item.id, trimmedName);
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-light">Usual amount to buy</label>
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
            disabled={isPending || !name.trim()}
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
