"use client";

import { useState, useTransition } from "react";
import {
  addRegimen,
  endRegimen,
  logDose,
  logSideEffect,
} from "./actions";

const KIND_LABELS: Record<string, string> = {
  patch: "Nicotine patch",
  gum: "Nicotine gum",
  lozenge: "Nicotine lozenge",
  inhaler: "Nicotine inhaler",
  spray: "Nicotine nasal spray",
  varenicline: "Varenicline (Chantix)",
  bupropion: "Bupropion (Zyban)",
  other: "Other",
};

const COMMON_SIDE_EFFECTS = [
  "Vivid dreams",
  "Nausea",
  "Headache",
  "Insomnia",
  "Skin irritation",
  "Dry mouth",
  "Dizziness",
];

export function AddRegimenForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await addRegimen(formData);
      if (r?.error) setError(r.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-neutral-700 dark:text-neutral-400"
      >
        + Add a medication or NRT
      </button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <p className="font-semibold">Add a medication or NRT</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select
            name="kind"
            defaultValue="patch"
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Schedule</span>
          <select
            name="schedule"
            defaultValue="daily"
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="daily">Daily</option>
            <option value="twice-daily">Twice daily</option>
            <option value="prn">As needed (PRN)</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Nicotine patch 21mg"
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Dose (mg, optional)</span>
          <input
            name="dose_mg"
            type="number"
            min={0}
            max={9999}
            step="0.5"
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Started on</span>
          <input
            name="started_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>
      <textarea
        name="notes"
        rows={2}
        maxLength={280}
        placeholder="Notes (prescribing clinician, taper plan, etc.)"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save regimen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function RegimenActions({
  regimenId,
  schedule,
}: {
  regimenId: string;
  schedule: string;
}) {
  const [pending, startTransition] = useTransition();
  const [doseCount, setDoseCount] = useState(1);
  const [sideOpen, setSideOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take(kind: "dose" | "skipped") {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("regimen_id", regimenId);
      fd.set("kind", kind);
      fd.set("count", String(doseCount));
      const r = await logDose(fd);
      if (r?.error) setError(r.error);
    });
  }

  function onSideSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await logSideEffect(formData);
      if (r?.error) setError(r.error);
      else setSideOpen(false);
    });
  }

  function onEndConfirm() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", regimenId);
      const r = await endRegimen(fd);
      if (r?.error) setError(r.error);
      else setEndOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => take("dose")}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          ✓ Took it
        </button>
        {schedule === "prn" && (
          <input
            type="number"
            min={1}
            max={20}
            value={doseCount}
            onChange={(e) => setDoseCount(Number(e.target.value))}
            className="w-14 rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            aria-label="dose count"
          />
        )}
        {schedule !== "prn" && (
          <button
            onClick={() => take("skipped")}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900 disabled:opacity-50"
          >
            Skipped
          </button>
        )}
        <button
          onClick={() => setSideOpen((v) => !v)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-amber-300 hover:text-amber-700 dark:border-neutral-700 dark:hover:border-amber-700"
        >
          Side effect
        </button>
        <button
          onClick={() => setEndOpen((v) => !v)}
          disabled={pending}
          className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 transition hover:text-red-600 dark:border-neutral-700"
        >
          End
        </button>
      </div>

      {sideOpen && (
        <form
          action={onSideSubmit}
          className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <input type="hidden" name="regimen_id" value={regimenId} />
          <div className="flex flex-wrap gap-1">
            {COMMON_SIDE_EFFECTS.map((s) => (
              <label
                key={s}
                className="cursor-pointer rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-800 transition has-[:checked]:bg-amber-200 dark:border-amber-700 dark:text-amber-300 dark:has-[:checked]:bg-amber-900/40"
              >
                <input
                  type="radio"
                  name="side_effect"
                  value={s}
                  className="sr-only"
                />
                {s}
              </label>
            ))}
          </div>
          <input
            name="notes"
            maxLength={280}
            placeholder="Notes (optional)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Log side effect"}
            </button>
            <button
              type="button"
              onClick={() => setSideOpen(false)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {endOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/50 dark:bg-red-950/30">
          <p>End this regimen? It will be marked as stopped today.</p>
          <div className="flex gap-2">
            <button
              onClick={onEndConfirm}
              disabled={pending}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Ending…" : "Yes, end it"}
            </button>
            <button
              onClick={() => setEndOpen(false)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
