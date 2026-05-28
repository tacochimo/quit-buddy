"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Minimal shape of the PayPal SDK API we touch.
type PayPalActions = {
  subscription: {
    create: (args: {
      plan_id: string;
      custom_id?: string;
    }) => Promise<string>;
  };
};
type PayPalButtonsOpts = {
  style?: Record<string, unknown>;
  createSubscription: (
    data: unknown,
    actions: PayPalActions,
  ) => Promise<string>;
  onApprove: (data: { subscriptionID: string }) => Promise<void> | void;
  onError?: (err: unknown) => void;
};
type PayPalNamespace = {
  Buttons: (opts: PayPalButtonsOpts) => {
    render: (selector: string | HTMLElement) => Promise<void>;
  };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export function PayPalButton({
  clientId,
  planId,
}: {
  clientId: string;
  planId: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!clientId || !planId) return;
    if (renderedRef.current) return;

    let cancelled = false;

    function render() {
      if (cancelled || renderedRef.current) return;
      if (!window.paypal || !containerRef.current) return;
      renderedRef.current = true;
      window.paypal
        .Buttons({
          style: { layout: "horizontal", label: "subscribe", height: 44 },
          createSubscription: (_data, actions) =>
            actions.subscription.create({ plan_id: planId }),
          onApprove: async (data) => {
            setConfirming(true);
            setError(null);
            try {
              const res = await fetch("/api/paypal/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscriptionId: data.subscriptionID }),
              });
              const body = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              if (!res.ok) {
                setError(body.error ?? `Confirm failed (${res.status})`);
                setConfirming(false);
                return;
              }
              router.push("/app/billing?status=success");
              router.refresh();
            } catch (e) {
              setError((e as Error).message ?? String(e));
              setConfirming(false);
            }
          },
          onError: (err) => {
            console.error("[paypal] button error:", err);
            setError("PayPal hit an error. Try again or use a card.");
          },
        })
        .render(containerRef.current);
    }

    if (window.paypal) {
      render();
      return;
    }

    const id = "paypal-sdk";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = render;
    script.onerror = () =>
      setError("Couldn't load PayPal. Check your network and try again.");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [clientId, planId, router]);

  if (!clientId || !planId) {
    return (
      <p className="text-xs text-neutral-500">
        PayPal isn&apos;t configured (missing client ID or plan ID).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} />
      {confirming && (
        <p className="text-xs text-neutral-500">Activating your plan…</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
