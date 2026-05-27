"use client";

import { useRef, useState, useTransition } from "react";
import { logCraving } from "./actions";

const TRIGGERS = [
  "Stress",
  "Boredom",
  "After meal",
  "With coffee",
  "Social",
  "Driving",
  "Anger",
  "Other",
];

type PlanByTrigger = Record<string, string>;

export function LogCravingForm({
  plansByTrigger = {},
}: {
  plansByTrigger?: PlanByTrigger;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [trigger, setTrigger] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await logCraving(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setIntensity(3);
        setTrigger("");
      }
    });
  }

  const activePlan = trigger ? plansByTrigger[trigger] : undefined;

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <p className="font-semibold">Log this craving</p>

      <div>
        <label className="text-sm font-medium">
          Intensity:{" "}
          <span className="ml-1 tabular-nums">{intensity}</span> / 5
        </label>
        <input
          type="range"
          name="intensity"
          min={1}
          max={5}
          step={1}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="mt-2 w-full accent-emerald-600"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Trigger</label>
        <select
          name="trigger"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">— pick one (optional) —</option>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
              {plansByTrigger[t] ? "  ·  has a plan" : ""}
            </option>
          ))}
        </select>
      </div>

      {activePlan && (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Your plan for {trigger}
          </p>
          <p className="italic text-emerald-900 dark:text-emerald-200">
            &ldquo;{activePlan}&rdquo;
          </p>
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Did it help?
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <PlanRadio value="yes" label="Yes" />
            <PlanRadio value="no" label="Tried, didn't help" />
            <PlanRadio value="unused" label="Didn't use it" />
          </div>
        </div>
      )}

      <textarea
        name="note"
        rows={2}
        maxLength={280}
        placeholder="What helped you through? (optional)"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Logging…" : "Log craving"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function PlanRadio({
  value,
  label,
}: {
  value: "yes" | "no" | "unused";
  label: string;
}) {
  return (
    <label className="cursor-pointer rounded-full border border-emerald-300 px-3 py-1 text-emerald-800 transition has-[:checked]:bg-emerald-200 dark:border-emerald-700 dark:text-emerald-300 dark:has-[:checked]:bg-emerald-900/50">
      <input
        type="radio"
        name="plan_used"
        value={value}
        className="sr-only"
      />
      {label}
    </label>
  );
}
