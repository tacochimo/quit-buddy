"use client";

import { Suspense, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

type Step = "email" | "code";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  // Where to send the user after sign-in. Only allow internal paths so a
  // crafted ?next= can't turn this into an open redirect.
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/app/home";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // We still set this for the magic-link fallback, but the user enters the
        // 6-digit code below instead — no cross-browser cookie issues.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        shouldCreateUser: true,
      },
    });

    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const token = code.trim();

    // signInWithOtp generates "email" type for existing users and "signup"
    // for first-timers when shouldCreateUser is true. Try both.
    let result = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (result.error) {
      result = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    }

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      router.push(safeNext as Route);
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-bold">Sign in</h1>

      {step === "email" ? (
        <>
          <p className="text-neutral-600 dark:text-neutral-400">
            Enter your email. We&apos;ll send you a sign-in code.
          </p>

          <form onSubmit={sendCode} className="flex flex-col gap-3">
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
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-neutral-600 dark:text-neutral-400">
            Check{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {email}
            </span>{" "}
            for the sign-in code.
          </p>

          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-center text-2xl tracking-widest dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="text-sm text-neutral-500 underline"
            >
              Use a different email
            </button>
          </form>
        </>
      )}

      {urlError && (
        <p className="text-sm text-red-600">Callback error: {urlError}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
