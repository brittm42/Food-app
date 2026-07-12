"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Collapsible from "@/components/Collapsible";
import { sendToKroger, setFavoriteProduct, removeFavoriteProduct } from "@/app/actions/kroger-send";
import type { ReviewItem } from "@/lib/kroger/review";

type LocalItem = ReviewItem & { included: boolean };

export default function KrogerReviewView({
  items,
  bannerName,
}: {
  items: ReviewItem[];
  bannerName: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<LocalItem[]>(
    items.map((item) => ({ ...item, included: item.candidates.length > 0 }))
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateRow(reviewId: string, patch: Partial<LocalItem>) {
    setRows((prev) => prev.map((r) => (r.reviewId === reviewId ? { ...r, ...patch } : r)));
  }

  function handleSend() {
    setError(null);
    const toSend = rows.filter((r) => r.included && r.selectedUpc);
    if (toSend.length === 0) {
      setError("Select at least one item to send.");
      return;
    }
    startTransition(async () => {
      const result = await sendToKroger(
        toSend.map((r) => ({
          label: r.label,
          category: r.category,
          neededValue: r.neededValue,
          neededUnit: r.neededUnit,
          sourceChecklistKey: r.sourceChecklistKey,
          sourceShoppingItemId: r.sourceShoppingItemId,
          upc: r.selectedUpc!,
          productDescription:
            r.candidates.find((c) => c.upc === r.selectedUpc)?.description ?? r.label,
          quantity: r.quantity,
        }))
      );
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/shopping");
      }
    });
  }

  const sections: { key: "fresh" | "pantry"; title: string }[] = [
    { key: "fresh", title: "Fresh" },
    { key: "pantry", title: "Pantry" },
  ];

  const includedCount = rows.filter((r) => r.included).length;

  return (
    <div className="flex flex-col gap-6 pb-20">
      <h1 className="font-display text-xl font-light">Send to {bannerName}</h1>
      <p className="text-sm text-ink-light -mt-4">
        Review the matched products and quantities before sending to your real {bannerName} cart.
      </p>

      {error && <p className="text-sm text-red">{error}</p>}

      {sections.map(({ key, title }) => {
        const sectionRows = rows.filter((r) => r.section === key);
        if (sectionRows.length === 0) return null;
        const categories = [...new Set(sectionRows.map((r) => r.category))];
        return (
          <Collapsible key={key} title={title}>
            <div className="flex flex-col gap-4">
              {categories.map((category) => (
                <Collapsible key={category} title={category}>
                  <div className="flex flex-col gap-2">
                    {sectionRows
                      .filter((r) => r.category === category)
                      .map((row) => (
                        <ReviewRow
                          key={row.reviewId}
                          row={row}
                          onChange={(patch) => updateRow(row.reviewId, patch)}
                        />
                      ))}
                  </div>
                </Collapsible>
              ))}
            </div>
          </Collapsible>
        );
      })}

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || includedCount === 0}
            className="w-full bg-ink text-white rounded-lg px-4 py-3 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            {isPending
              ? "Sending…"
              : `Send ${includedCount} item${includedCount === 1 ? "" : "s"} to Kroger`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  onChange,
}: {
  row: LocalItem;
  onChange: (patch: Partial<LocalItem>) => void;
}) {
  const hasMatch = row.candidates.length > 0;
  const [isPending, startTransition] = useTransition();
  const isFavorite = row.favoriteUpc != null && row.favoriteUpc === row.selectedUpc;

  function toggleFavorite() {
    const selected = row.candidates.find((c) => c.upc === row.selectedUpc);
    if (!selected) return;
    if (isFavorite) {
      onChange({ favoriteUpc: null });
      startTransition(() => {
        removeFavoriteProduct(row.label);
      });
    } else {
      onChange({ favoriteUpc: selected.upc });
      startTransition(() => {
        setFavoriteProduct(row.label, selected.upc, selected.description, selected.brand);
      });
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={row.included}
          disabled={!hasMatch}
          onChange={(e) => onChange({ included: e.target.checked })}
          className="w-4 h-4 accent-teal cursor-pointer flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm">{row.label}</div>
          {row.neededValue != null && row.neededUnit && (
            <div className="text-xs text-ink-light">
              needs {row.neededValue} {row.neededUnit}
            </div>
          )}
        </div>
      </div>

      {hasMatch ? (
        <div className="flex items-center gap-2 pl-6">
          <select
            value={row.selectedUpc ?? ""}
            onChange={(e) => onChange({ selectedUpc: e.target.value })}
            disabled={!row.included}
            className="flex-1 min-w-0 border border-border rounded-lg px-2 py-1.5 text-xs bg-surface focus:outline-none focus:border-teal disabled:opacity-50"
          >
            {row.candidates.map((c) => (
              <option key={c.upc} value={c.upc}>
                {c.brand ? `${c.brand} — ` : ""}
                {c.description}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={!row.included || isPending}
            aria-label={isFavorite ? `Unfavorite ${row.label}` : `Favorite this ${row.label} pick`}
            className={`w-6 h-6 rounded text-xs cursor-pointer flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${
              isFavorite ? "text-gold" : "border border-border text-ink-light hover:border-gold hover:text-gold"
            }`}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onChange({ quantity: Math.max(1, row.quantity - 1) })}
              disabled={!row.included}
              className="w-6 h-6 border border-border rounded text-xs cursor-pointer disabled:opacity-50"
            >
              −
            </button>
            <span className="w-5 text-center text-xs">{row.quantity}</span>
            <button
              type="button"
              onClick={() => onChange({ quantity: row.quantity + 1 })}
              disabled={!row.included}
              className="w-6 h-6 border border-border rounded text-xs cursor-pointer disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      ) : row.searchFailed ? (
        <p className="text-xs text-red pl-6">
          Couldn&apos;t search Kroger for this item right now — won&apos;t be sent. Try reloading this page.
        </p>
      ) : (
        <p className="text-xs text-ink-light pl-6">No Kroger match found — won&apos;t be sent.</p>
      )}
    </div>
  );
}
