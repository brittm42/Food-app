"use client";

import { useState, useTransition } from "react";
import { submitFeedback, type FeedbackCategory } from "@/app/actions/feedback";

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "idea", label: "Idea" },
  { id: "other", label: "Other" },
];

export default function FeedbackForm() {
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback(category, message);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
        setMessage("");
      }
    });
  }

  if (sent) {
    return <p className="text-sm text-teal">Thanks — sent.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors cursor-pointer ${
              category === c.id
                ? "bg-ink text-white border-ink"
                : "border-border hover:border-teal"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's on your mind?"
        rows={5}
        maxLength={2000}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-teal resize-none"
      />
      {error && <p className="text-sm text-red">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !message.trim()}
        className="self-start bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
