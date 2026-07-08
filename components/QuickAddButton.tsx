"use client";

import { useState } from "react";
import QuickAddModal from "@/components/QuickAddModal";

export default function QuickAddButton({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  function submit(close: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    close();
  }

  return (
    <QuickAddModal triggerAriaLabel={label} headerLabel={label} onSubmit={submit}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
      />
    </QuickAddModal>
  );
}
