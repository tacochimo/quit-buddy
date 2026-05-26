"use client";

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
} from "./push-actions";

type State =
  | "loading"
  | "unsupported"
  | "denied"
  | "off"
  | "subscribing"
  | "on"
  | "error";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;
        const existing = await reg.pushManager.getSubscription();
        setState(existing ? "on" : "off");
      } catch (e) {
        setError(String(e));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setError("Server not configured (missing VAPID key)");
      setState("error");
      return;
    }
    setError(null);
    setState("subscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        throw new Error("Incomplete subscription returned by browser");
      }
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent,
      });
      if (result?.error) throw new Error(result.error);
      setState("on");
    } catch (e: unknown) {
      setError((e as Error).message ?? String(e));
      setState("error");
    }
  }

  async function disable() {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e: unknown) {
      setError((e as Error).message ?? String(e));
      setState("error");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-semibold">Push notifications</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Get notified when someone in your channel cheers you.
      </p>

      <div className="mt-3">
        {state === "loading" && (
          <p className="text-sm text-neutral-500">Checking…</p>
        )}
        {state === "unsupported" && (
          <p className="text-sm text-neutral-500">
            Your browser doesn&apos;t support push notifications.
          </p>
        )}
        {state === "denied" && (
          <p className="text-sm text-neutral-500">
            You&apos;ve blocked notifications. Enable them in your browser
            settings, then reload.
          </p>
        )}
        {state === "off" && (
          <button
            onClick={enable}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Enable notifications
          </button>
        )}
        {state === "subscribing" && (
          <p className="text-sm text-neutral-500">Asking permission…</p>
        )}
        {state === "on" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-emerald-600">✓ On</span>
            <button
              onClick={disable}
              className="text-sm text-neutral-500 underline hover:text-neutral-700"
            >
              Turn off
            </button>
          </div>
        )}
        {state === "error" && (
          <p className="text-sm text-red-600">Error: {error}</p>
        )}

        {/iPhone|iPad|iPod/.test(
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        ) && (
          <p className="mt-3 text-xs text-neutral-500">
            On iPhone: install this app to your Home Screen first (Share →
            &ldquo;Add to Home Screen&rdquo;), then enable from inside the
            installed app.
          </p>
        )}
      </div>
    </section>
  );
}
