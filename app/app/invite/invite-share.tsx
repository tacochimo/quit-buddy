"use client";

import { useState, useTransition } from "react";

export function InviteShare({ code, url }: { code: string; url: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function tryShare() {
    setStatus(null);
    startTransition(async () => {
      try {
        if (typeof navigator !== "undefined" && "share" in navigator) {
          await (navigator as Navigator & {
            share: (data: ShareData) => Promise<void>;
          }).share({
            title: "Quit smoking with me",
            text: `Joining me on Embergo? Use my code ${code} when you sign up.`,
            url,
          });
          setStatus("Shared.");
          return;
        }
        await copy(url);
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "AbortError") return;
        setStatus(`Couldn't share: ${(e as Error).message}`);
      }
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied.");
    } catch {
      setStatus("Couldn't copy. Long-press to copy manually.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={tryShare}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Sharing…" : "Share invite"}
      </button>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => copy(code)}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Copy code
        </button>
        <button
          type="button"
          onClick={() => copy(url)}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Copy link
        </button>
      </div>
      {status && <p className="text-xs text-neutral-500">{status}</p>}
    </div>
  );
}
