"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { spinToday } from "./actions";
import { OUTCOMES, type OutcomeMeta } from "@/lib/spin";

const SEGMENT_COUNT = OUTCOMES.length;
const SEGMENT_DEG = 360 / SEGMENT_COUNT;
const SEGMENT_COLORS = [
  "#ecfdf5", // emerald-50
  "#fef3c7", // amber-100
  "#dbeafe", // blue-100
  "#fce7f3", // pink-100
  "#ede9fe", // violet-100
  "#f1f5f9", // slate-100
];

export function SpinWheel({
  initial,
}: {
  initial: OutcomeMeta | null;
}) {
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<OutcomeMeta | null>(initial);
  const [rotation, setRotation] = useState(initial ? indexFor(initial) * -SEGMENT_DEG - 720 : 0);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  function go() {
    if (requestedRef.current || spinning || result) return;
    requestedRef.current = true;
    setError(null);
    setSpinning(true);
    startTransition(async () => {
      const res = await spinToday();
      if (!res.ok) {
        setError(res.error);
        setSpinning(false);
        requestedRef.current = false;
        return;
      }
      const idx = indexFor(res.outcome);
      // Spin: 5 full turns + land with the pointer on the chosen segment.
      const finalDeg = -idx * SEGMENT_DEG - 360 * 5 - SEGMENT_DEG / 2;
      setRotation(finalDeg);
      // Reveal result after the wheel settles.
      setTimeout(() => {
        setResult(res.outcome);
        setSpinning(false);
      }, 3200);
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-72 w-72">
        {/* Pointer */}
        <div
          aria-hidden
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-2xl"
        >
          ▼
        </div>
        {/* Wheel */}
        <div
          className="relative h-full w-full overflow-hidden rounded-full border-8 border-neutral-200 shadow-xl transition-transform dark:border-neutral-800"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: spinning ? "3s" : "0ms",
            transitionTimingFunction: "cubic-bezier(.17,.67,.18,1)",
          }}
        >
          {OUTCOMES.map((o, i) => (
            <Slice
              key={o.id}
              index={i}
              color={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
              emoji={o.emoji}
            />
          ))}
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-neutral-900 shadow dark:border-neutral-900 dark:bg-neutral-100" />
        </div>
      </div>

      {result ? (
        <ResultCard outcome={result} />
      ) : (
        <button
          type="button"
          onClick={go}
          disabled={spinning}
          className="rounded-full bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <p className="text-center text-xs text-neutral-500">
          Come back tomorrow for another spin.
        </p>
      )}
    </div>
  );
}

function indexFor(o: OutcomeMeta): number {
  return OUTCOMES.findIndex((x) => x.id === o.id);
}

function Slice({
  index,
  color,
  emoji,
}: {
  index: number;
  color: string;
  emoji: string;
}) {
  const angle = index * SEGMENT_DEG;
  // Use conic-gradient-ish wedge with absolute-positioned triangles.
  return (
    <div
      className="absolute left-0 top-0 h-full w-full origin-center"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <div
        className="absolute left-1/2 top-0 h-1/2 w-1/2 origin-bottom-left"
        style={{
          background: color,
          transform: `skewY(${90 - SEGMENT_DEG}deg)`,
        }}
      />
      <div
        className="absolute left-1/2 top-4 -translate-x-1/2 text-xl"
        style={{ transform: `translateX(-50%) rotate(${SEGMENT_DEG / 2}deg)` }}
      >
        {emoji}
      </div>
    </div>
  );
}

function ResultCard({ outcome }: { outcome: OutcomeMeta }) {
  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-6 text-center dark:border-emerald-700 dark:bg-emerald-950/30">
      <p className="text-4xl" aria-hidden>
        {outcome.emoji}
      </p>
      <p className="text-lg font-bold">{outcome.label}</p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {outcome.body}
      </p>
    </div>
  );
}
