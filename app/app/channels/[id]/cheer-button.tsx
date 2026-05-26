"use client";

import { useTransition } from "react";
import { sendCheer } from "./actions";

export function CheerButton({
  channelId,
  toUserId,
  count,
}: {
  channelId: string;
  toUserId: string;
  count: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await sendCheer(channelId, toUserId);
        })
      }
      disabled={pending}
      className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-emerald-950/30"
    >
      👏 {count}
    </button>
  );
}
