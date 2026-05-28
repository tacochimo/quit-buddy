"use client";

import { useState, useTransition } from "react";

export function ShareButton({
  url,
  imagePath,
}: {
  url: string;
  imagePath: string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function tryNativeShare() {
    setStatus(null);
    startTransition(async () => {
      try {
        // Prefer sharing the URL — most platforms render a rich preview from
        // the OG metadata on /share/[token], which embeds the image.
        if (typeof navigator !== "undefined" && "share" in navigator) {
          await (navigator as Navigator & {
            share: (data: ShareData) => Promise<void>;
          }).share({
            title: "I'm smoke-free.",
            text: "Joining me?",
            url,
          });
          setStatus("Shared.");
          return;
        }
        await copyLink();
      } catch (e) {
        // User cancelled = AbortError; treat silently.
        const name = (e as { name?: string }).name;
        if (name === "AbortError") return;
        setStatus(`Couldn't share: ${(e as Error).message}`);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Couldn't copy. Long-press the link to copy.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={tryNativeShare}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Sharing…" : "Share"}
      </button>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={copyLink}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Copy link
        </button>
        <a
          href={imagePath}
          download="quit-streak.png"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-center transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Download image
        </a>
      </div>
      {status && <p className="text-xs text-neutral-500">{status}</p>}
    </div>
  );
}
