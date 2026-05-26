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

export function LogCravingForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
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
      }
    });
  }

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
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">— pick one (optional) —</option>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

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
