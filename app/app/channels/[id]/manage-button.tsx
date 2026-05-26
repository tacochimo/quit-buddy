"use client";

import { useState, useTransition } from "react";
import { deleteChannel, leaveChannel } from "./actions";

export function ManageButton({
  channelId,
  isOwner,
}: {
  channelId: string;
  isOwner: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = isOwner
        ? await deleteChannel(channelId)
        : await leaveChannel(channelId);
      if (result?.error) setError(result.error);
    });
  }

  const actionLabel = isOwner ? "Delete channel" : "Leave channel";
  const confirmCopy = isOwner
    ? "Deleting removes this channel and all its activity for every member. This can't be undone."
    : "You'll stop seeing this channel's leaderboard and activity. Members will see you leave.";

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-neutral-500 underline hover:text-red-600"
      >
        {actionLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <p className="text-sm">{confirmCopy}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Working…" : `Yes, ${actionLabel.toLowerCase()}`}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
