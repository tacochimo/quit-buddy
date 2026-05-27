// Builds the data bundle for the doctor-ready PDF export. Pulls profile,
// current streak, quit history, cravings + their patterns, and milestone
// stars — everything a clinician would want to see in one page.

import { createClient } from "./supabase/server";
import { computeSavings, computeStreak } from "./streak";
import { computeInsights, type Craving } from "./craving-insights";

export type ReportData = {
  generatedAt: Date;
  patient: {
    displayName: string;
    email: string;
    quitDate: Date;
    baselineCigsPerDay: number | null;
    costPerPack: number | null;
    cigsPerPack: number;
    reasons: string | null;
  };
  streak:
    | { kind: "quit"; days: number; quitDate: Date }
    | { kind: "relapse"; relapseDate: Date }
    | { kind: "none" };
  savings: { cigsAvoided: number; moneySaved: number };
  history: {
    totalQuitAttempts: number;
    totalRelapses: number;
    longestStreakDays: number;
  };
  cravings: {
    total: number;
    last30dCount: number;
    avgIntensity: number | null;
    insights: ReturnType<typeof computeInsights>;
  };
  meds: {
    active: Array<{
      name: string;
      kind: string;
      doseMg: number | null;
      schedule: "daily" | "twice-daily" | "prn";
      startedOn: Date;
      daysOn: number;
      adherencePct: number | null; // null for prn or short windows
      prnTotal30d: number; // 0 unless schedule === 'prn'
    }>;
    past: Array<{ name: string; startedOn: Date; endedOn: Date }>;
    sideEffects: Array<{ label: string; count: number }>;
  };
  milestones: number[]; // achieved milestone day-counts, sorted ascending
};

const MILESTONE_PATTERN = /^milestone_(\d+)d$/;

export async function buildReport(userId: string): Promise<ReportData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return null;

  const thirtyDaysAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    profileRes,
    eventsRes,
    cravingsRes,
    starsRes,
    regimensRes,
    medEventsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, quit_date, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons, timezone",
      )
      .eq("id", userId)
      .single(),
    // All quit/relapse events for history reconstruction. Capped at 200 — a
    // user with more relapse attempts than that has bigger problems than
    // page count.
    supabase
      .from("streak_events")
      .select("type, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("cravings")
      .select("intensity, trigger, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("stars")
      .select("kind")
      .eq("user_id", userId)
      .is("channel_id", null),
    supabase
      .from("med_regimens")
      .select("id, name, kind, dose_mg, schedule, started_on, ended_on")
      .eq("user_id", userId)
      .order("started_on", { ascending: false }),
    supabase
      .from("med_events")
      .select("regimen_id, occurred_at, kind, count, side_effect")
      .eq("user_id", userId)
      .gte("occurred_at", thirtyDaysAgoIso),
  ]);

  const profile = profileRes.data;
  if (!profile?.quit_date) return null;

  const events = eventsRes.data ?? [];
  const cravings: Craving[] = cravingsRes.data ?? [];
  const stars = starsRes.data ?? [];

  const latest = events[0] ?? null;
  const streakState = computeStreak(
    latest as { type: "quit" | "relapse"; occurred_at: string } | null,
  );
  const streak: ReportData["streak"] =
    streakState.kind === "quit"
      ? { kind: "quit", days: streakState.days, quitDate: streakState.quitDate }
      : streakState.kind === "relapse"
        ? { kind: "relapse", relapseDate: streakState.relapseDate }
        : { kind: "none" };

  const days = streak.kind === "quit" ? streak.days : 0;
  const savings = computeSavings({
    days,
    cigsPerDay: profile.baseline_cigs_per_day,
    costPerPack: profile.cost_per_pack,
    cigsPerPack: profile.cigs_per_pack,
  });

  // History: replay events oldest-first to find the longest sustained quit
  // streak and to count attempts/relapses.
  const ordered = [...events].reverse();
  let longest = 0;
  let attempts = 0;
  let relapses = 0;
  let lastQuitAt: Date | null = null;
  for (const ev of ordered) {
    const at = new Date(ev.occurred_at);
    if (ev.type === "quit") {
      attempts++;
      lastQuitAt = at;
    } else {
      relapses++;
      if (lastQuitAt) {
        const span = Math.floor(
          (at.getTime() - lastQuitAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (span > longest) longest = span;
        lastQuitAt = null;
      }
    }
  }
  // If they're currently on an active streak, it counts toward longest.
  if (streak.kind === "quit" && streak.days > longest) longest = streak.days;

  // Craving aggregates.
  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30d = cravings.filter(
    (c) => new Date(c.created_at).getTime() >= cutoff30d,
  );
  const avgIntensity =
    cravings.length === 0
      ? null
      : Math.round(
          (cravings.reduce((s, c) => s + c.intensity, 0) / cravings.length) *
            10,
        ) / 10;

  // Milestones achieved (from stars table — these are the canonical record).
  const milestoneDays = stars
    .map((s) => {
      const m = MILESTONE_PATTERN.exec(s.kind);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => n !== null);

  // Meds: split active vs past; compute adherence over the report window.
  const regimens = regimensRes.data ?? [];
  const medEvents = medEventsRes.data ?? [];
  const now = Date.now();

  const sideEffectCounts = new Map<string, number>();
  for (const ev of medEvents) {
    if (ev.kind === "side_effect" && ev.side_effect) {
      sideEffectCounts.set(
        ev.side_effect,
        (sideEffectCounts.get(ev.side_effect) ?? 0) + 1,
      );
    }
  }

  const active = regimens
    .filter((r) => !r.ended_on)
    .map((r) => {
      const started = new Date(r.started_on);
      const daysOn = Math.max(
        1,
        Math.floor((now - started.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      );
      // Adherence window = intersection of [started, now] and [30d ago, now].
      const windowStart = Math.max(
        started.getTime(),
        now - 30 * 24 * 60 * 60 * 1000,
      );
      const windowDays = Math.max(
        1,
        Math.ceil((now - windowStart) / (1000 * 60 * 60 * 24)),
      );
      const myDoseEvents = medEvents.filter(
        (ev) =>
          ev.regimen_id === r.id &&
          ev.kind === "dose" &&
          new Date(ev.occurred_at).getTime() >= windowStart,
      );
      const totalDoses = myDoseEvents.reduce(
        (s, ev) => s + (ev.count ?? 1),
        0,
      );
      const expectedPerDay =
        r.schedule === "daily" ? 1 : r.schedule === "twice-daily" ? 2 : 0;
      const adherencePct =
        expectedPerDay > 0 && windowDays >= 2
          ? Math.min(
              100,
              Math.round((totalDoses / (expectedPerDay * windowDays)) * 100),
            )
          : null;
      return {
        name: r.name,
        kind: r.kind,
        doseMg: r.dose_mg,
        schedule: r.schedule as "daily" | "twice-daily" | "prn",
        startedOn: started,
        daysOn,
        adherencePct,
        prnTotal30d: r.schedule === "prn" ? totalDoses : 0,
      };
    });

  const past = regimens
    .filter((r) => r.ended_on)
    .map((r) => ({
      name: r.name,
      startedOn: new Date(r.started_on),
      endedOn: new Date(r.ended_on as string),
    }));

  const sideEffects = [...sideEffectCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return {
    generatedAt: new Date(),
    patient: {
      displayName: profile.display_name,
      email: user.email ?? "",
      quitDate: new Date(profile.quit_date),
      baselineCigsPerDay: profile.baseline_cigs_per_day,
      costPerPack: profile.cost_per_pack,
      cigsPerPack: profile.cigs_per_pack ?? 20,
      reasons: profile.reasons,
    },
    streak,
    savings,
    history: {
      totalQuitAttempts: attempts,
      totalRelapses: relapses,
      longestStreakDays: longest,
    },
    cravings: {
      total: cravings.length,
      last30dCount: last30d.length,
      avgIntensity,
      insights: computeInsights(cravings, { tz: profile.timezone ?? null }),
    },
    meds: { active, past, sideEffects },
    milestones: [...new Set(milestoneDays)].sort((a, b) => a - b),
  };
}
