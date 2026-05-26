"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        We&apos;ll email you a magic link. No password.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "sent"}
          className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Check your email"
              : "Send magic link"}
        </button>
      </form>

      {urlError && (
        <p className="text-sm text-red-600">Callback error: {urlError}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "sent" && (
        <p className="text-sm text-emerald-600">
          Sent. Open the link from your inbox on this device.
        </p>
      )}
    </main>
  );
}
