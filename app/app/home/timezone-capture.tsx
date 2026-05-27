"use client";

import { useEffect } from "react";
import { saveTimezone } from "./timezone-actions";

// Fires once on mount when the user has no timezone yet. Reads the browser's
// IANA tz and stores it on their profile. Self-healing for existing users.
export function TimezoneCapture({ needs }: { needs: boolean }) {
  useEffect(() => {
    if (!needs) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) void saveTimezone(tz);
    } catch {
      // ignore — best-effort
    }
  }, [needs]);
  return null;
}
