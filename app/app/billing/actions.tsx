"use client";

import { useState, useTransition } from "react";
import type { Tier } from "@/lib/subscription";

export function BillingActions({
  tier,
  hasCustomer,
}: {
  tier: Tier;
  hasCustomer: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function go(path: "/api/stripe/checkout" | "/api/stripe/portal") {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(path, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!res.ok || !body.url) {
          setError(body.error ?? `Request failed (${res.status})`);
          return;
        }
        window.location.href = body.url;
      } catch (e) {
        setError((e as Error).message ?? String(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {tier === "free" ? (
        <button
          onClick={() => go("/api/stripe/checkout")}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Loading…" : "Upgrade to Plus — $4.99/mo"}
        </button>
      ) : (
        hasCustomer && (
          <button
            onClick={() => go("/api/stripe/portal")}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900 disabled:opacity-50"
          >
            {pending ? "Loading…" : "Manage subscription"}
          </button>
        )
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
