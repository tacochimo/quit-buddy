"use client";

import { useState, useTransition } from "react";
import {
  acceptBuddy,
  cancelPendingInvite,
  inviteBuddy,
  removeBuddy,
} from "./actions";

export function InviteCard() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await inviteBuddy();
      if (result?.error) setError(result.error);
      // On success the page revalidates and renders the pending state.
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="font-semibold">Invite a buddy</p>
      <p className="mt-1 text-sm text-neutral-500">
        We&apos;ll generate a short code. Send it to the one person you trust to
        be in your corner.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Creating code…" : "Generate invite code"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

export function AcceptForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await acceptBuddy(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <label className="font-semibold" htmlFor="buddy-code">
        Got a code from someone?
      </label>
      <input
        id="buddy-code"
        name="code"
        type="text"
        autoComplete="off"
        maxLength={12}
        placeholder="e.g. AB23CD"
        className="rounded-lg border border-neutral-300 px-3 py-2 font-mono text-lg uppercase tracking-widest dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white transition hover:bg-black disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        {pending ? "Joining…" : "Become buddies"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function CancelButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await cancelPendingInvite();
        })
      }
      disabled={pending}
      className="text-sm text-amber-900 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200"
    >
      {pending ? "Cancelling…" : "Cancel this invite"}
    </button>
  );
}

export function RemoveButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        End buddy
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>End the buddy connection?</span>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await removeBuddy();
          })
        }
        disabled={pending}
        className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "Ending…" : "Yes, end it"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-neutral-500 underline"
      >
        Keep
      </button>
    </div>
  );
}
