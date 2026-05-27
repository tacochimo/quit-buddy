// Derives actionable patterns from craving logs. Pure functions — same input
// always yields same output, no DB calls. Used by the cravings page and by
// the AI coach (so it can reference the user's actual patterns).

export type Craving = {
  intensity: number; // 1..5
  trigger: string | null;
  created_at: string; // ISO
};

export type HourWindow = { startHour: number; endHour: number; count: number };

export type Insights = {
  total: number;
  // Hour-of-day cluster: the 3-hour window holding the most cravings, when
  // it's meaningfully concentrated (>= 35% of cravings, >= 4 in the window).
  peakWindow: HourWindow | null;
  // Top non-generic trigger with its avg intensity. Excludes "Other"/null
  // because those aren't actionable.
  topTrigger: { name: string; count: number; avgIntensity: number } | null;
  // Direction of intensity change over the last 14 days vs the prior 14.
  // null when there isn't enough data on both sides.
  intensityTrend: {
    recent: number;
    prior: number;
    deltaPct: number;
    direction: "down" | "up" | "flat";
  } | null;
  // Cravings per week, current vs prior. null when insufficient data.
  frequencyTrend: {
    recent: number;
    prior: number;
    direction: "down" | "up" | "flat";
  } | null;
};

const HOUR_WINDOW = 3;

function hourOf(iso: string): number {
  // Local hour — patterns are anchored to the user's day, not UTC.
  return new Date(iso).getHours();
}

function within(iso: string, sinceMs: number, untilMs: number): boolean {
  const t = new Date(iso).getTime();
  return t >= sinceMs && t < untilMs;
}

export function computeInsights(
  cravings: Craving[],
  now: Date = new Date(),
): Insights {
  const total = cravings.length;

  return {
    total,
    peakWindow: findPeakWindow(cravings),
    topTrigger: findTopTrigger(cravings),
    intensityTrend: findIntensityTrend(cravings, now),
    frequencyTrend: findFrequencyTrend(cravings, now),
  };
}

function findPeakWindow(cravings: Craving[]): HourWindow | null {
  if (cravings.length < 6) return null;

  // 24 buckets, then slide a 3-hour window to find the densest start.
  const byHour = new Array<number>(24).fill(0);
  for (const c of cravings) byHour[hourOf(c.created_at)]++;

  let bestStart = 0;
  let bestCount = 0;
  for (let start = 0; start < 24; start++) {
    let count = 0;
    for (let i = 0; i < HOUR_WINDOW; i++) count += byHour[(start + i) % 24];
    if (count > bestCount) {
      bestCount = count;
      bestStart = start;
    }
  }

  const share = bestCount / cravings.length;
  if (bestCount < 4 || share < 0.35) return null;

  return {
    startHour: bestStart,
    endHour: (bestStart + HOUR_WINDOW) % 24,
    count: bestCount,
  };
}

function findTopTrigger(
  cravings: Craving[],
): Insights["topTrigger"] {
  const buckets = new Map<string, { count: number; sum: number }>();
  for (const c of cravings) {
    const t = c.trigger?.trim();
    if (!t || t.toLowerCase() === "other") continue;
    const b = buckets.get(t) ?? { count: 0, sum: 0 };
    b.count++;
    b.sum += c.intensity;
    buckets.set(t, b);
  }
  if (buckets.size === 0) return null;

  let bestName = "";
  let bestCount = 0;
  let bestSum = 0;
  for (const [name, { count, sum }] of buckets) {
    if (count > bestCount) {
      bestName = name;
      bestCount = count;
      bestSum = sum;
    }
  }
  if (bestCount < 3) return null;

  return {
    name: bestName,
    count: bestCount,
    avgIntensity: Math.round((bestSum / bestCount) * 10) / 10,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;

function direction(recent: number, prior: number): "down" | "up" | "flat" {
  if (prior === 0) return "flat";
  const delta = (recent - prior) / prior;
  if (delta <= -0.15) return "down";
  if (delta >= 0.15) return "up";
  return "flat";
}

function findIntensityTrend(
  cravings: Craving[],
  now: Date,
): Insights["intensityTrend"] {
  const nowMs = now.getTime();
  const midMs = nowMs - WINDOW_DAYS * DAY_MS;
  const startMs = nowMs - 2 * WINDOW_DAYS * DAY_MS;

  const recent: number[] = [];
  const prior: number[] = [];
  for (const c of cravings) {
    if (within(c.created_at, midMs, nowMs)) recent.push(c.intensity);
    else if (within(c.created_at, startMs, midMs)) prior.push(c.intensity);
  }
  if (recent.length < 3 || prior.length < 3) return null;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const r = Math.round(avg(recent) * 10) / 10;
  const p = Math.round(avg(prior) * 10) / 10;
  const deltaPct = Math.round(((r - p) / p) * 100);
  return { recent: r, prior: p, deltaPct, direction: direction(r, p) };
}

function findFrequencyTrend(
  cravings: Craving[],
  now: Date,
): Insights["frequencyTrend"] {
  const nowMs = now.getTime();
  const midMs = nowMs - 7 * DAY_MS;
  const startMs = nowMs - 14 * DAY_MS;

  let recent = 0;
  let prior = 0;
  for (const c of cravings) {
    if (within(c.created_at, midMs, nowMs)) recent++;
    else if (within(c.created_at, startMs, midMs)) prior++;
  }
  // Need at least a few in either window to call a trend.
  if (recent + prior < 4) return null;
  return { recent, prior, direction: direction(recent, prior) };
}

// Renders the most actionable insight (or two) for inclusion in the AI coach
// system prompt. Kept short — the coach should use this as context, not
// recite it back verbatim.
export function insightsForCoach(insights: Insights): string | null {
  if (insights.total < 4) return null;

  const lines: string[] = [];
  if (insights.peakWindow) {
    const { startHour, endHour, count } = insights.peakWindow;
    lines.push(
      `Their cravings cluster between ${fmtHour(startHour)} and ${fmtHour(endHour)} (${count} of ${insights.total} logged cravings).`,
    );
  }
  if (insights.topTrigger) {
    const { name, count, avgIntensity } = insights.topTrigger;
    lines.push(
      `Their top trigger is "${name}" (${count} cravings, avg intensity ${avgIntensity}/5).`,
    );
  }
  if (insights.intensityTrend && insights.intensityTrend.direction !== "flat") {
    const { recent, prior, direction } = insights.intensityTrend;
    lines.push(
      `Craving intensity is ${direction} (${prior} → ${recent} over the last 2 weeks).`,
    );
  }
  return lines.length > 0 ? lines.join(" ") : null;
}

export function fmtHour(h: number): string {
  const hour = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour}${ampm}`;
}
