"use client";

import { useTransition } from "react";
import { toggleChecked } from "@/app/actions/pantry";

type Item = { key: string; label: string; note?: string; checked: boolean };

export default function ShoppingListView({
  fresh,
  core,
  weekly,
  staples,
  hasQueue,
}: {
  fresh: Item[];
  core: Item[];
  weekly: Item[];
  staples: Item[];
  hasQueue: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle(key: string) {
    startTransition(() => {
      toggleChecked(key);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-light">Shopping List</h1>

      {!hasQueue && (
        <p className="text-sm text-ink-light text-center py-4">
          Nothing queued in This Week yet — add meals there and their
          ingredients will show up here.
        </p>
      )}

      {fresh.length > 0 && (
        <ChecklistSection
          title="Buy Fresh"
          items={fresh}
          onToggle={toggle}
          disabled={isPending}
        />
      )}
      {core.length > 0 && (
        <ChecklistSection
          title="Check Core Pantry"
          items={core}
          onToggle={toggle}
          disabled={isPending}
        />
      )}
      <ChecklistSection
        title="Weekly Fresh — Always Buy"
        items={weekly}
        onToggle={toggle}
        disabled={isPending}
      />
      {staples.length > 0 && (
        <ChecklistSection
          title="My Staples"
          items={staples}
          onToggle={toggle}
          disabled={isPending}
        />
      )}
    </div>
  );
}

function ChecklistSection({
  title,
  items,
  onToggle,
  disabled,
}: {
  title: string;
  items: Item[];
  onToggle: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <section>
      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
        {title}
      </h2>
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
    </section>
  );
}
