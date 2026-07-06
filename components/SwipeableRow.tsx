"use client";

import { useRef, useState } from "react";

// Reveal width: how far a partial swipe opens before showing the full
// Delete button. Delete threshold: swipe past this far and releasing
// deletes immediately, no confirm tap needed (matches the standard
// iOS Mail/Reminders swipe-to-delete pattern — partial swipe requires a
// confirm tap, a full swipe deletes on release).
const REVEAL_WIDTH = 84;
const DELETE_THRESHOLD = 160;
const MAX_DRAG = DELETE_THRESHOLD + 40;

export default function SwipeableRow({
  onDelete,
  deleteLabel,
  disabled,
  children,
}: {
  onDelete: () => void;
  deleteLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseX = useRef(0);
  const axis = useRef<"horizontal" | "vertical" | null>(null);
  // Logic-critical "is a touch in progress" flag lives in a ref, not state:
  // setDragging(true) in touchstart doesn't commit synchronously (React
  // batches state updates), so a touchmove arriving before the next render
  // would still see the stale `dragging === false` closure and bail out —
  // a real race on a fast swipe, not just a test-harness artifact. Refs
  // update immediately, so the very next event sees the current value.
  const draggingRef = useRef(false);
  const translateXRef = useRef(0);

  function triggerDelete() {
    setTranslateX(-window.innerWidth);
    setTimeout(onDelete, 150);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    baseX.current = translateXRef.current;
    axis.current = null;
    draggingRef.current = true;
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabled || !draggingRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (axis.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (axis.current === "vertical") return; // let the page scroll normally

    // React attaches touchmove listeners as passive, so e.preventDefault()
    // here is a silent no-op (logs a console warning, does nothing) — the
    // touch-action: pan-y CSS below is what actually stops the browser from
    // hijacking a horizontal drag for its own scroll/navigation gestures.
    const next = Math.max(Math.min(0, baseX.current + dx), -MAX_DRAG);
    translateXRef.current = next;
    setTranslateX(next);
  }

  function handleTouchEnd() {
    if (disabled || !draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (axis.current !== "horizontal") return;

    const current = translateXRef.current;
    let next: number;
    if (current <= -DELETE_THRESHOLD) {
      triggerDelete();
      return;
    } else if (current <= -REVEAL_WIDTH / 2) {
      next = -REVEAL_WIDTH;
    } else {
      next = 0;
    }
    translateXRef.current = next;
    setTranslateX(next);
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          disabled={disabled}
          onClick={triggerDelete}
          aria-label={deleteLabel}
          style={{ width: REVEAL_WIDTH }}
          className="bg-red text-white text-[10px] font-mono uppercase tracking-wide flex items-center justify-center cursor-pointer disabled:opacity-50 rounded-lg"
        >
          Delete
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="touch-pan-y"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
