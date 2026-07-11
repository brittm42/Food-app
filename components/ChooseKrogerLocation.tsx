"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findKrogerLocations, selectKrogerLocation } from "@/app/actions/kroger";
import type { KrogerLocation } from "@/lib/kroger/locations";

export default function ChooseKrogerLocation({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [locations, setLocations] = useState<KrogerLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectingId, setSelectingId] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await findKrogerLocations(zip);
      if ("error" in result) {
        setError(result.error);
        setLocations(null);
      } else {
        setLocations(result.locations);
      }
    });
  }

  function handleSelect(loc: KrogerLocation) {
    setError(null);
    setSelectingId(loc.locationId);
    startTransition(async () => {
      const result = await selectKrogerLocation(loc.locationId, loc.name, loc.chain);
      if (result?.error) {
        setError(result.error);
        setSelectingId(null);
      } else {
        router.push(returnTo);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-light">Which store do you shop at?</h1>
      <p className="text-sm text-ink-light -mt-2">
        This gets you real prices and availability instead of generic listings.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="Zip code"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-base bg-surface focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red">{error}</p>}

      {locations && (
        <div className="flex flex-col gap-2">
          {locations.length === 0 && (
            <p className="text-sm text-ink-light">No stores found near that zip code.</p>
          )}
          {locations.map((loc) => (
            <button
              key={loc.locationId}
              type="button"
              onClick={() => handleSelect(loc)}
              disabled={isPending}
              className="text-left bg-surface border border-border rounded-lg px-3 py-2.5 hover:border-teal cursor-pointer disabled:opacity-50"
            >
              <div className="text-sm font-medium">
                {loc.name}
                {selectingId === loc.locationId && isPending && " …"}
              </div>
              <div className="text-xs text-ink-light">
                {loc.addressLine1}, {loc.city}, {loc.state} {loc.zipCode}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
