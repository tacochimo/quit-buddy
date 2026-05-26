"use client";

import { useState, useTransition } from "react";
import { runMyNudge } from "./nudge-actions";

export function NudgeTest() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const r = await runMyNudge();
      if (r?.error) setResult(`Error: ${r.error}`);
      else if (r?.kind)
        setResult(
          `Sent a ${r.kind} nudge. Check /app/coach + your push notifications.`,
        );
      else setResult(`No nudge fired (reason: ${r?.reason ?? "unknown"})`);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-semibold">Test coach nudge</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Force the nudge logic for your account so you can see what it produces.
      </p>
      <button
        onClick={onClick}
        disabled={pending}
        className="mt-3 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending ? "Running…" : "Send me a test nudge"}
      </button>
      {result && (
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {result}
        </p>
      )}
    </section>
  );
}
