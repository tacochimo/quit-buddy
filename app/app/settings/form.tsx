"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

type Defaults = {
  display_name: string;
  quit_date: string;
  baseline_cigs_per_day: number;
  cost_per_pack: number | string;
  cigs_per_pack: number;
};

export function SettingsForm({ defaults }: { defaults: Defaults }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <Field label="Display name">
        <input
          type="text"
          name="display_name"
          required
          minLength={1}
          maxLength={50}
          defaultValue={defaults.display_name}
          className={inputCls}
        />
      </Field>

      <Field
        label="Quit date"
        hint="Changing this resets your current streak."
      >
        <input
          type="date"
          name="quit_date"
          required
          defaultValue={defaults.quit_date}
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
          defaultValue={defaults.baseline_cigs_per_day}
          className={inputCls}
        />
      </Field>

      <Field label="Cost per pack">
        <input
          type="number"
          name="cost_per_pack"
          required
          min={0.01}
          step={0.01}
          defaultValue={defaults.cost_per_pack}
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
          defaultValue={defaults.cigs_per_pack}
          className={inputCls}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
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
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
