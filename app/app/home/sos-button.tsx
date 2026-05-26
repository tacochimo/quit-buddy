"use client";

import { useState, useTransition } from "react";
import { resolveSOS, sendSOS } from "./sos-actions";

export function SOSButton({ hasChannels }: { hasChannels: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendSOS(note);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setNote("");
      }
    });
  }

  if (!hasChannels) {
    return (
      <p className="text-center text-xs text-neutral-500">
        Create or join a channel to use SOS support.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
      >
        🆘 I need support
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
      <p className="text-sm font-medium">
        Send a quick SOS to your channel-mates.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        placeholder="What's hitting you right now? (optional)"
        rows={3}
        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <button
          onClick={onSend}
          disabled={pending}
          className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send SOS"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm transition hover:bg-amber-100 dark:border-amber-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function ActiveSOSBanner({
  note,
  sentAt,
}: {
  note: string | null;
  sentAt: Date;
}) {
  const [pending, startTransition] = useTransition();

  function onResolve() {
    startTransition(async () => {
      await resolveSOS();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
      <div>
        <p className="text-sm font-semibold">SOS sent to your channels</p>
        {note && (
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            &ldquo;{note}&rdquo;
          </p>
        )}
        <p className="mt-1 text-xs text-neutral-500">
          {Math.max(0, Math.floor((Date.now() - sentAt.getTime()) / 60000))} min
          ago
        </p>
      </div>
      <button
        onClick={onResolve}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Resolving…" : "I'm OK now"}
      </button>
    </div>
  );
}
