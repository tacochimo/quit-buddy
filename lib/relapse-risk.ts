// Heuristic relapse-risk scorer. Rules-based on purpose — with the data
// volume of a single user's logs, a handful of well-chosen signals beats a
// trained model and stays explainable (so the coach can name the reason).

import { computeInsights, type Craving } from "./craving-insights";

export type RiskLevel = "low" | "elevated" | "high";

// Stable identifiers for the rules that fired. Used by the runner to skip
// re-nudging on the same signal day-after-day, and by message generation
// to mention the actual reason.
export type RiskReason =
  | "withdrawal_window"
  | "craving_cluster"
  | "recent_high_intensity"
  | "weekend_evening";

export type RelapseRisk = {
  level: RiskLevel;
  score: number; // 0..1
  reasons: RiskReason[];
  // Personal peak craving window (when computeInsights has enough data).
  // Included so the nudge can name a specific time to watch out for.
  peakWindow: { startHour: number; endHour: number } | null;
};

const DAY_MS = 24 * 3600 * 1000;

export function computeRelapseRisk(args: {
  streakDays: number;
  cravings: Craving[];
  now?: Date;
}): RelapseRisk {
  const now = args.now ?? new Date();
  const nowMs = now.getTime();
  const reasons: RiskReason[] = [];
  let score = 0;

  // 1. Acute withdrawal — days 1..4 of an active quit. The literature is
  // unambiguous that this is when most relapses happen.
  if (args.streakDays >= 1 && args.streakDays <= 4) {
    score += 0.4;
    reasons.push("withdrawal_window");
  }

  // 2. Craving acceleration — 3+ logged in the last 24h.
  const last24h = args.cravings.filter(
    (c) => nowMs - new Date(c.created_at).getTime() < DAY_MS,
  );
  if (last24h.length >= 3) {
    score += 0.3;
    reasons.push("craving_cluster");
  }

  // 3. Any high-intensity craving (>=4) in last 24h — strong urges.
  if (last24h.some((c) => c.intensity >= 4)) {
    score += 0.3;
    reasons.push("recent_high_intensity");
  }

  // 4. Weekend evening — drinking + social contexts skew Fri/Sat 6pm+.
  // Server is UTC; this is a coarse signal so the timezone slop is OK.
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if ((day === 5 || day === 6) && hour >= 18) {
    score += 0.1;
    reasons.push("weekend_evening");
  }

  const peak = computeInsights(args.cravings, now).peakWindow;

  let level: RiskLevel = "low";
  if (score >= 0.6) level = "high";
  else if (score >= 0.3) level = "elevated";

  return {
    level,
    score: Math.min(score, 1),
    reasons,
    peakWindow: peak
      ? { startHour: peak.startHour, endHour: peak.endHour }
      : null,
  };
}
