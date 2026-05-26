"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={onCopy}
      title="Tap to copy"
      className="rounded bg-neutral-100 px-2 py-0.5 font-mono transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
    >
      {copied ? "Copied!" : code}
    </button>
  );
}
