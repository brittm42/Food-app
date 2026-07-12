"use client";

import { useEffect, useRef, useState } from "react";

function playAlertTone() {
  const AudioCtxClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return;
  const ctx = new AudioCtxClass();
  [0, 0.35, 0.7].forEach((delay) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.3);
  });
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RecipeTimer({ seconds, label }: { seconds: number; label: string }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const [done, setDone] = useState(false);
  const alertedRef = useRef(false);

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const remaining = endAt - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !alertedRef.current) {
        alertedRef.current = true;
        setDone(true);
        playAlertTone();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [endAt]);

  const start = () => {
    alertedRef.current = false;
    setDone(false);
    setEndAt(Date.now() + seconds * 1000);
  };

  const reset = () => {
    alertedRef.current = false;
    setDone(false);
    setEndAt(null);
    setRemainingMs(seconds * 1000);
  };

  if (endAt === null) {
    return (
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1 bg-gold-light text-gold rounded px-1.5 py-0.5 text-[12.5px] font-medium cursor-pointer hover:brightness-95 align-baseline"
      >
        ⏱ {label}
      </button>
    );
  }

  if (done) {
    return (
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1 bg-coral text-white rounded px-1.5 py-0.5 text-[12.5px] font-medium cursor-pointer animate-pulse align-baseline"
      >
        ⏰ Time&apos;s up!
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={reset}
      title="Tap to cancel"
      className="inline-flex items-center gap-1 bg-gold text-white rounded px-1.5 py-0.5 text-[12.5px] font-medium tabular-nums cursor-pointer align-baseline"
    >
      ⏱ {formatRemaining(remainingMs)}
    </button>
  );
}
