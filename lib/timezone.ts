// Resolves "what's the local hour/minute/date in this IANA timezone right now".
// Uses Intl, which is available in Node 18+. Returns null parts on bad input
// rather than throwing — cron is best-effort.

export type LocalNow = {
  date: string; // YYYY-MM-DD in the tz
  hour: number; // 0-23
  minute: number; // 0-59
  dow: number; // 0=Sun..6=Sat
};

export function getLocalNow(tz: string | null, now: Date = new Date()): LocalNow | null {
  if (!tz) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    let hour = Number(get("hour"));
    if (hour === 24) hour = 0; // Intl in some locales returns "24" for midnight
    const minute = Number(get("minute"));
    const wd = get("weekday");
    const dowMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return null;
    }
    return {
      date: `${year}-${month}-${day}`,
      hour,
      minute,
      dow: dowMap[wd] ?? 0,
    };
  } catch {
    return null;
  }
}

// Returns minutes-of-day for an "HH:MM" string. -1 on bad input.
export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return -1;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return -1;
  return h * 60 + mm;
}
