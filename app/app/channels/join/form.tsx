"use client";

import { useState, useTransition } from "react";
import { joinChannel } from "../actions";

export function JoinChannelForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await joinChannel(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Invite code</span>
        <input
          type="text"
          name="code"
          required
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABC234"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-center text-xl uppercase tracking-widest dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join channel"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
