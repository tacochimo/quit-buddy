"use client";

import Link from "next/link";
import { useTransition } from "react";
import { restartStreak } from "./actions";

export function RelapseButton({ canRelapse }: { canRelapse: boolean }) {
  if (!canRelapse) return null;
  return (
    <Link
      href="/app/slip"
      className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-400"
    >
      I slipped
    </Link>
  );
}

export function RestartButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => { await restartStreak(); })}
      disabled={pending}
      className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Starting…" : "Start a new streak"}
    </button>
  );
}
