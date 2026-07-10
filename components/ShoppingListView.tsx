"use client";

import { useRef, useState, useTransition } from "react";
import { toggleChecked } from "@/app/actions/pantry";
import { toggleCoreItemChecked } from "@/app/actions/pantry-on-hand";
import { addShoppingItem, removeShoppingItem } from "@/app/actions/shopping";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";

// neededValue/neededUnit are only ever populated on Core-section items
// (the seam that already computes a per-ingredient needed quantity for
// reconciliation, app/shopping/page.tsx) — undefined for Fresh/Weekly,
// which have no such concept and just use the plain toggle.
type Item = {
  key: string;
  label: string;
  note?: string;
  checked: boolean;
  neededValue?: number | null;
  neededUnit?: string | null;
};
type RestockItem = { key: string; label: string };
type OneOffItem = { id: string; label: string; isFood: boolean; quantity: string | null };
type CategoryGroup<T> = { category: string; items: T[] };

export default function ShoppingListView({
  fresh,
  core,
  weekly,
  restock,
  oneOff,
  hasQueue,
}: {
  fresh: Item[];
  core: CategoryGroup<Item>[];
  weekly: Item[];
  restock: CategoryGroup<RestockItem>[];
  oneOff: OneOffItem[];
  hasQueue: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [removedItem, setRemovedItem] = useState<OneOffItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(item: Item) {
    startTransition(() => {
      toggleChecked(item.key);
    });
  }

  // Core items have a computed needed quantity (this week's queued
  // recipes) — checking one on/off also adjusts on-hand by that amount.
  // Fresh/Weekly have no such concept, so they use the plain toggle above.
  function toggleCore(item: Item) {
    startTransition(() => {
      toggleCoreItemChecked(item.key, item.label, item.neededValue ?? null, item.neededUnit ?? null);
    });
  }

  function checkOffRestock(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  // Unlike everything else here, a one-off item is a hard delete — there's
  // no toggle to flip back. Hold onto what was just removed for a few
  // seconds so an accidental tap is recoverable via the Undo banner below.
  function checkOffOneOff(item: OneOffItem) {
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
      addShoppingItem(removedItem.label, removedItem.isFood, removedItem.quantity);
    });
    setRemovedItem(null);
  }

  const foodItems = oneOff.filter((i) => i.isFood);
  const nonFoodItems = oneOff.filter((i) => !i.isFood);

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
      <Collapsible title="Weekly Fresh — Always Buy">
        <ChecklistSection items={weekly} onToggle={toggle} disabled={isPending} />
      </Collapsible>

      {restock.length > 0 && (
        <Collapsible title="Restock">
          <div className="flex flex-col gap-4">
            {restock.map((group) => (
              <Collapsible key={group.category} title={group.category}>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={isPending}
                        onChange={() => checkOffRestock(item.key)}
                        className="w-4 h-4 accent-gold cursor-pointer flex-shrink-0"
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
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

      <Collapsible title="Shopping List">
        <div className="flex flex-col gap-3">
          {foodItems.length === 0 && nonFoodItems.length === 0 && (
            <p className="text-xs text-ink-light">
              No one-off items yet — use the + button above to add something
              like paper towels, without it becoming a permanent staple.
            </p>
          )}
          {foodItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {foodItems.map((item) => (
                <OneOffRow key={item.id} item={item} onCheckOff={checkOffOneOff} disabled={isPending} />
              ))}
            </div>
          )}
          {nonFoodItems.length > 0 && (
            <Collapsible title="Non-food">
              <div className="flex flex-col gap-1.5">
                {nonFoodItems.map((item) => (
                  <OneOffRow key={item.id} item={item} onCheckOff={checkOffOneOff} disabled={isPending} />
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

function OneOffRow({
  item,
  onCheckOff,
  disabled,
}: {
  item: OneOffItem;
  onCheckOff: (item: OneOffItem) => void;
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
        {item.quantity && <span className="text-ink-light text-xs"> — {item.quantity}</span>}
      </span>
    </label>
  );
}

function AddOneOffButton() {
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isFood, setIsFood] = useState(true);
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(() => {
      addShoppingItem(trimmed, isFood, quantity.trim() || null);
    });
    setValue("");
    setQuantity("");
    setIsFood(true);
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
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Quantity (optional) — e.g. 2 rolls"
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setIsFood(true)}
          className={`flex-1 font-mono text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded-full cursor-pointer transition-colors ${
            isFood ? "bg-ink text-white" : "bg-surface-warm text-ink-light"
          }`}
        >
          Food
        </button>
        <button
          type="button"
          onClick={() => setIsFood(false)}
          className={`flex-1 font-mono text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded-full cursor-pointer transition-colors ${
            !isFood ? "bg-ink text-white" : "bg-surface-warm text-ink-light"
          }`}
        >
          Non-food
        </button>
      </div>
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
          <span
            className={`text-sm ${item.checked ? "line-through text-ink-light" : ""}`}
          >
            {item.label}
            {item.note && (
              <span className="text-ink-light text-xs"> — {item.note}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
