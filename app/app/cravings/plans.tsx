"use client";

import { useState, useTransition } from "react";
import { saveTriggerPlan, deleteTriggerPlan } from "./plan-actions";
import type { TriggerPlan } from "@/lib/trigger-plans";

const TRIGGERS = [
  "Stress",
  "Boredom",
  "After meal",
  "With coffee",
  "Social",
  "Driving",
  "Anger",
];

export function TriggerPlans({
  plans,
  suggestedTrigger,
}: {
  plans: TriggerPlan[];
  suggestedTrigger: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const planForSuggested = suggestedTrigger
    ? plans.find((p) => p.trigger === suggestedTrigger)
    : null;
  const showSuggestion = Boolean(suggestedTrigger && !planForSuggested);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        If-then plans
      </h2>

      {showSuggestion && suggestedTrigger && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            You don&apos;t have a plan for {suggestedTrigger} yet.
          </p>
          <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
            That&apos;s your most common trigger — write a one-line plan you
            can fall back on without thinking.
          </p>
          <button
            onClick={() => setEditing(`new:${suggestedTrigger}`)}
            className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            Write a plan for {suggestedTrigger}
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {plans.map((p) => (
          <PlanRow
            key={p.id}
            plan={p}
            editing={editing === p.id}
            onEdit={() => setEditing(p.id)}
            onCancel={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        ))}
      </ul>

      {editing?.startsWith("new:") ? (
        <PlanForm
          initialTrigger={editing.slice("new:".length)}
          existingTriggers={plans.map((p) => p.trigger)}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : editing === "new" ? (
        <PlanForm
          existingTriggers={plans.map((p) => p.trigger)}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          onClick={() => setEditing("new")}
          className="self-start rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-neutral-700 dark:text-neutral-400"
        >
          + Add a plan
        </button>
      )}
    </section>
  );
}

function PlanRow({
  plan,
  editing,
  onEdit,
  onCancel,
  onSaved,
}: {
  plan: TriggerPlan;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", plan.id);
      const r = await deleteTriggerPlan(fd);
      if (r?.error) setError(r.error);
    });
  }

  if (editing) {
    return (
      <li>
        <PlanForm
          initialTrigger={plan.trigger}
          initialPlan={plan.plan}
          lockTrigger
          existingTriggers={[]}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <p>
        <span className="text-neutral-500">When </span>
        <span className="font-semibold">{plan.trigger}</span>
        <span className="text-neutral-500">, I will: </span>
        <span>{plan.plan}</span>
      </p>
      <div className="mt-2 flex gap-3 text-xs">
        <button
          onClick={onEdit}
          className="text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          disabled={pending}
          className="text-neutral-500 underline hover:text-red-600 disabled:opacity-50"
        >
          {pending ? "deleting…" : "delete"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function PlanForm({
  initialTrigger,
  initialPlan,
  existingTriggers,
  lockTrigger,
  onSaved,
  onCancel,
}: {
  initialTrigger?: string;
  initialPlan?: string;
  existingTriggers: string[];
  lockTrigger?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await saveTriggerPlan(formData);
      if (r?.error) setError(r.error);
      else onSaved();
    });
  }

  const taken = new Set(existingTriggers);
  const availableTriggers = TRIGGERS.filter(
    (t) => t === initialTrigger || !taken.has(t),
  );

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-300 p-4 dark:border-neutral-700"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-500">When this happens:</span>
        {lockTrigger ? (
          <>
            <input type="hidden" name="trigger" value={initialTrigger} />
            <p className="font-semibold">{initialTrigger}</p>
          </>
        ) : (
          <select
            name="trigger"
            defaultValue={initialTrigger ?? ""}
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="" disabled>
              — pick one —
            </option>
            {availableTriggers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-500">I will:</span>
        <textarea
          name="plan"
          rows={2}
          maxLength={280}
          required
          defaultValue={initialPlan ?? ""}
          placeholder="e.g. Drink a glass of water, breathe for one minute, then go for a 5-min walk."
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save plan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
