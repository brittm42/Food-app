"use client";

import { useState, useTransition } from "react";
import { toggleChecked } from "@/app/actions/pantry";
import { addShoppingItem, removeShoppingItem } from "@/app/actions/shopping";
import Collapsible from "@/components/Collapsible";
import QuickAddModal from "@/components/QuickAddModal";

type Item = { key: string; label: string; note?: string; checked: boolean };
type RestockItem = { key: string; label: string };
type OneOffItem = { id: string; label: string; isFood: boolean };
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

  function toggle(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  function checkOffRestock(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  function checkOffOneOff(id: string) {
    startTransition(() => {
      removeShoppingItem(id);
    });
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
                <ChecklistSection items={group.items} onToggle={toggle} disabled={isPending} />
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
  onCheckOff: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={false}
        disabled={disabled}
        onChange={() => onCheckOff(item.id)}
        className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0"
      />
      <span className="text-sm">{item.label}</span>
    </label>
  );
}

function AddOneOffButton() {
  const [value, setValue] = useState("");
  const [isFood, setIsFood] = useState(true);
  const [isPending, startTransition] = useTransition();

  function submit(close: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(() => {
      addShoppingItem(trimmed, isFood);
    });
    setValue("");
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
  onToggle: (key: string) => void;
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
            onChange={() => onToggle(item.key)}
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
