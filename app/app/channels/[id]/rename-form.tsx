"use client";

import { useState, useTransition } from "react";
import { renameChannel } from "./actions";

export function RenameChannel({
  channelId,
  currentName,
}: {
  channelId: string;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        aria-label="Rename channel"
        title="Rename channel"
        className="ml-2 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        ✎
      </button>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={50}
        className="rounded border border-neutral-300 px-2 py-1 text-base dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await renameChannel(channelId, name);
            if (result?.error) {
              setError(result.error);
            } else {
              setEditing(false);
            }
          })
        }
        disabled={pending}
        className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => {
          setName(currentName);
          setEditing(false);
          setError(null);
        }}
        className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
      >
        ×
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}
