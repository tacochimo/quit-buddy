"use client";

import { useState, useTransition } from "react";
import { saveOnboarding } from "./actions";

export function OnboardingForm({ defaultQuitDate }: { defaultQuitDate: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboarding(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <Field label="When did you quit?" hint="Use today if you're quitting now.">
        <input
          type="date"
          name="quit_date"
          required
          defaultValue={defaultQuitDate}
          max={defaultQuitDate}
          className={inputCls}
        />
      </Field>

      <Field label="Cigarettes per day (before quitting)">
        <input
          type="number"
          name="baseline_cigs_per_day"
          required
          min={1}
          max={200}
          defaultValue={10}
          className={inputCls}
        />
      </Field>

      <Field label="Cost per pack" hint="Local currency, e.g. dollars.">
        <input
          type="number"
          name="cost_per_pack"
          required
          min={0.01}
          step={0.01}
          defaultValue={8}
          className={inputCls}
        />
      </Field>

      <Field label="Cigarettes per pack">
        <input
          type="number"
          name="cigs_per_pack"
          required
          min={1}
          max={50}
          defaultValue={20}
          className={inputCls}
        />
      </Field>

      <Field
        label="Why are you quitting?"
        hint="Optional. We'll resurface this when you're struggling."
      >
        <textarea
          name="reasons"
          rows={3}
          maxLength={500}
          placeholder="For my kids. To stop wasting money. To breathe better when I run."
          className={inputCls}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Start tracking"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      {children}
      {hint && (
        <span className="text-xs text-neutral-500">{hint}</span>
      )}
    </label>
  );
}
