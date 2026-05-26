"use client";

import { useState, useTransition } from "react";
import { recordRelapse, restartStreak } from "./actions";

export function RelapseButton({ canRelapse }: { canRelapse: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      await recordRelapse();
      setConfirming(false);
    });
  }

  if (!canRelapse) return null;

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-400"
      >
        I slipped
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <p className="text-sm">
        This will reset your streak to 0. You can start a new one right away.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Yes, reset"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RestartButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => { await restartStreak(); })}
      disabled={pending}
      className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Starting…" : "Start a new streak"}
    </button>
  );
}
