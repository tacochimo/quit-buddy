"use client";

import { useOptimistic, useTransition } from "react";
import { logMood } from "./mood-actions";
import { MOOD_CHIPS, type Mood, moodEmoji, moodLabel } from "@/lib/mood";

export function MoodCard({ today }: { today: Mood | null }) {
  const [current, setCurrent] = useOptimistic(
    today,
    (_: Mood | null, next: Mood) => next,
  );
  const [, startTransition] = useTransition();

  function pick(mood: Mood) {
    startTransition(async () => {
      setCurrent(mood);
      await logMood(mood);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          How are you today?
        </p>
        {current && (
          <p className="text-xs text-neutral-500">
            Today: {moodEmoji(current)} {moodLabel(current)}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOOD_CHIPS.map((c) => {
          const selected = current === c.mood;
          return (
            <button
              key={c.mood}
              onClick={() => pick(c.mood)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
