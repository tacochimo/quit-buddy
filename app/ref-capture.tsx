"use client";

import { useEffect } from "react";

// On the landing page, if the URL has ?ref=CODE, drop a 30-day cookie that
// the onboarding server action will read after sign-up. Cookie not HttpOnly
// because nothing sensitive — just a referral attribution token.

const COOKIE_NAME = "qb_ref";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function RefCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (!ref) return;
      const cleaned = ref.trim().toUpperCase().slice(0, 32);
      if (!cleaned) return;
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(cleaned)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch {
      // ignore
    }
  }, []);
  return null;
}
