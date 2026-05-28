"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Initializes PostHog client-side for pageviews + (optional) session replay.
// User identification is set lazily via setIdentity from authenticated pages.

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  try {
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: false, // narrow signal — only explicit events + pageviews
      person_profiles: "identified_only",
      disable_session_recording: true, // turn on later if you want replays
    });
    initialized = true;
  } catch (e) {
    console.error("[analytics] PostHog client init failed:", e);
  }
}

export function AnalyticsProvider({
  userId,
}: {
  userId: string | null;
}) {
  useEffect(() => {
    ensureInit();
    if (!initialized) return;
    if (userId) {
      try {
        posthog.identify(userId);
      } catch (e) {
        console.error("[analytics] identify failed:", e);
      }
    } else {
      try {
        posthog.reset();
      } catch {
        // ignore
      }
    }
  }, [userId]);
  return null;
}
