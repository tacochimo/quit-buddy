"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "in" | "hold1" | "out" | "hold2";

const PHASE_DURATION_MS = 4000;
const PHASE_ORDER: Phase[] = ["in", "hold1", "out", "hold2"];

const PHASE_TEXT: Record<Phase, string> = {
  in: "Breathe in…",
  hold1: "Hold",
  out: "Breathe out…",
  hold2: "Hold",
};

// Target scale per phase — circle expands on inhale, contracts on exhale.
const PHASE_SCALE: Record<Phase, number> = {
  in: 1,
  hold1: 1,
  out: 0.45,
  hold2: 0.45,
};

export function BreatheExercise() {
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycles, setCycles] = useState(0);
  const phaseRef = useRef(phaseIdx);
  phaseRef.current = phaseIdx;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const next = (phaseRef.current + 1) % PHASE_ORDER.length;
      setPhaseIdx(next);
      if (next === 0) setCycles((c) => c + 1);
    };
    const interval = setInterval(tick, PHASE_DURATION_MS);
    return () => clearInterval(interval);
  }, [running]);

  function start() {
    setPhaseIdx(0);
    setCycles(0);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    setPhaseIdx(0);
  }

  const phase = PHASE_ORDER[phaseIdx];
  const scale = running ? PHASE_SCALE[phase] : 0.6;

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="relative flex h-72 w-72 items-center justify-center">
        <div
          className="absolute h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 opacity-90 transition-transform ease-in-out"
          style={{
            transform: `scale(${scale})`,
            transitionDuration: `${PHASE_DURATION_MS}ms`,
          }}
        />
        <div className="relative z-10 text-center">
          <p className="text-2xl font-semibold text-white drop-shadow">
            {running ? PHASE_TEXT[phase] : "Ready?"}
          </p>
          {running && (
            <p className="mt-1 text-sm text-white/80">
              cycle {cycles + 1}
            </p>
          )}
        </div>
      </div>

      {running ? (
        <button
          onClick={stop}
          className="rounded-full border border-neutral-300 px-8 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={start}
          className="rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700"
        >
          Start breathing
        </button>
      )}
    </div>
  );
}
