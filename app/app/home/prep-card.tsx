"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { togglePrepStep } from "./prep-actions";
import { PREP_STEPS } from "@/lib/prep";

export function PrepCard({
  daysUntil,
  completedIds,
}: {
  daysUntil: number;
  completedIds: string[];
}) {
  const [completed, setCompleted] = useOptimistic(
    new Set(completedIds),
    (state: Set<string>, action: { id: string; done: boolean }) => {
      const next = new Set(state);
      if (action.done) next.add(action.id);
      else next.delete(action.id);
      return next;
    },
  );
  const [, startTransition] = useTransition();

  function toggle(id: string, done: boolean) {
    startTransition(async () => {
      setCompleted({ id, done });
      await togglePrepStep(id, done);
    });
  }

  const total = PREP_STEPS.length;
  const doneCount = completed.size;

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Quit-day prep
        </p>
        <p className="text-xs font-mono text-amber-700 dark:text-amber-400">
          {doneCount} / {total}
        </p>
      </div>
      <h2 className="mt-1 text-xl font-bold">
        {daysUntil === 0
          ? "Your quit day is today."
          : daysUntil === 1
            ? "1 day until your quit date."
            : `${daysUntil} days until your quit date.`}
      </h2>
      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
        Quits that prep beat quits that don&apos;t. Work through these before the
        day arrives — most take 5 minutes.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {PREP_STEPS.map((s) => {
          const done = completed.has(s.id);
          return (
            <li
              key={s.id}
              className={`rounded-xl border bg-white p-3 transition dark:bg-neutral-950 ${
                done
                  ? "border-emerald-300 dark:border-emerald-800"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      done
                        ? "text-neutral-400 line-through dark:text-neutral-500"
                        : ""
                    }`}
                  >
                    {s.label}
                  </p>
                  {!done && (
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {s.body}
                    </p>
                  )}
                  {!done && s.href && (
                    <Link
                      href={s.href}
                      className="mt-2 inline-block text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      {s.hrefLabel ?? "Open"}
                    </Link>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
