"use client";

import { useState, useTransition } from "react";
import { recordSlip } from "./actions";

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

type Kind = "slip" | "relapse";

export function SlipForm() {
  const [kind, setKind] = useState<Kind>("slip");
  const [intensity, setIntensity] = useState(3);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordSlip(formData);
      if (result?.error) setError(result.error);
      // Success path redirects from the server action.
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      {/* 1. Triage */}
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          1 · What happened?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <KindChoice
            value="slip"
            current={kind}
            onSelect={setKind}
            title="A slip"
            body="One moment — a cigarette or two. I'm not going back."
          />
          <KindChoice
            value="relapse"
            current={kind}
            onSelect={setKind}
            title="A relapse"
            body="I'm smoking again. Reset my streak."
          />
        </div>
        <input type="hidden" name="kind" value={kind} />
        {kind === "slip" && (
          <div className="mt-1">
            <label className="text-sm font-medium">
              How many cigarettes? (optional)
            </label>
            <input
              type="number"
              name="count"
              min={1}
              max={99}
              placeholder="e.g. 1"
              className="mt-1 w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        )}
        <p className="text-xs text-neutral-500">
          {kind === "slip"
            ? "A slip won't reset your streak — what you've earned still counts."
            : "This resets your streak to day 0. You can start a new one right after."}
        </p>
      </section>

      {/* 2. Context */}
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          2 · The context
        </p>
        <div>
          <label className="text-sm font-medium">
            Intensity of the urge:{" "}
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
          name="what_was_happening"
          rows={2}
          maxLength={280}
          placeholder="What was happening? (optional)"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </section>

      {/* 3. Forward */}
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          3 · Next time
        </p>
        <textarea
          name="what_id_do_differently"
          rows={2}
          maxLength={280}
          placeholder="What would you do differently? (optional)"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p className="text-xs text-neutral-500">
          {kind === "slip"
            ? "After saving, you'll land in the coach with this context loaded."
            : "After saving, you'll land on Home where you can start a new streak."}
        </p>
      </section>

      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-3 font-semibold text-white transition disabled:opacity-50 ${
          kind === "relapse"
            ? "bg-red-600 hover:bg-red-700"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {pending
          ? "Saving…"
          : kind === "relapse"
            ? "Save and reset my streak"
            : "Save and talk to coach"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function KindChoice({
  value,
  current,
  onSelect,
  title,
  body,
}: {
  value: Kind;
  current: Kind;
  onSelect: (v: Kind) => void;
  title: string;
  body: string;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${
        selected
          ? value === "relapse"
            ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
            : "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
          : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
      }`}
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {body}
      </span>
    </button>
  );
}
