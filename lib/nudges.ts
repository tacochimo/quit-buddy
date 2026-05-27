import OpenAI from "openai";
import type { StreakState } from "./streak";
import type { Persona } from "./personas";
import type { RelapseRisk } from "./relapse-risk";
import type { HourWindow } from "./craving-insights";
import type { TriggerPlan } from "./trigger-plans";
import type { LocalNow } from "./timezone";
import { fmtHour } from "./craving-insights";

const MILESTONE_DAYS = [1, 7, 30, 90, 180, 365];

export type NudgeKind =
  | "idle"
  | "milestone_coming"
  | "milestone_hit"
  | "relapse_risk"
  | "pre_peak";

export type NudgeDecision = {
  kind: NudgeKind;
  milestoneDays?: number;
  risk?: RelapseRisk;
  peakWindow?: HourWindow;
  topTrigger?: string;
  plan?: string; // user's if-then plan for the top trigger, when present
};

const PRE_PEAK_LEAD_MIN = 15;

// Did the user's peak window start within the last 15 minutes (or is it
// starting within the next 15)? Returns true during the "lead window".
function inPrePeakLead(
  peakWindow: HourWindow,
  localNow: LocalNow,
): boolean {
  const startMin = peakWindow.startHour * 60;
  const nowMin = localNow.hour * 60 + localNow.minute;
  // Diff in [-1440, 1440]; normalize to nearest signed distance.
  let diff = startMin - nowMin;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff >= 0 && diff <= PRE_PEAK_LEAD_MIN;
}

export function decideNudge(args: {
  streak: StreakState;
  lastNudgeAt: Date | null;
  lastChatAt: Date | null;
  lastPrePeakAt: Date | null;
  risk?: RelapseRisk;
  peakWindow?: HourWindow | null;
  topTrigger?: string | null;
  plans?: TriggerPlan[];
  localNow?: LocalNow | null;
  now?: Date;
}): NudgeDecision | null {
  const now = args.now ?? new Date();

  // Only nudge users on an active streak — don't push someone who just relapsed.
  if (args.streak.kind !== "quit") return null;
  const days = args.streak.days;

  // Pre-peak runs on its own cadence (once per day), independent of the 22h
  // global cooldown. Check it FIRST so it can fire alongside other decisions
  // (but still defer to milestones below if a milestone lands today).
  const prePeakCandidate =
    args.peakWindow &&
    args.localNow &&
    inPrePeakLead(args.peakWindow, args.localNow)
      ? buildPrePeak(args)
      : null;

  // Skip the standard (22h-cooldown) nudges if we nudged within the last 22h.
  // pre_peak doesn't count against this cooldown — it has its own dedup.
  let standardAllowed = true;
  if (args.lastNudgeAt) {
    const sinceMs = now.getTime() - args.lastNudgeAt.getTime();
    if (sinceMs < 22 * 60 * 60 * 1000) standardAllowed = false;
  }

  if (standardAllowed) {
    // Just-hit a milestone today — celebrate. (Highest priority.)
    if (MILESTONE_DAYS.includes(days)) {
      return { kind: "milestone_hit", milestoneDays: days };
    }

    const coming = MILESTONE_DAYS.find((m) => m - days === 1);
    if (coming) return { kind: "milestone_coming", milestoneDays: coming };
  }

  // Pre-peak fires after milestone priority but before risk/idle. Its dedup
  // is once-per-day, tracked separately.
  if (prePeakCandidate) {
    const lastPrePeak = args.lastPrePeakAt?.getTime() ?? 0;
    if (now.getTime() - lastPrePeak > 20 * 60 * 60 * 1000) {
      return prePeakCandidate;
    }
  }

  if (!standardAllowed) return null;

  if (args.risk && args.risk.level !== "low") {
    const lastChat = args.lastChatAt?.getTime() ?? 0;
    if (now.getTime() - lastChat > 24 * 60 * 60 * 1000) {
      return { kind: "relapse_risk", risk: args.risk };
    }
  }

  if (days >= 2) {
    const lastChat = args.lastChatAt?.getTime() ?? 0;
    if (now.getTime() - lastChat > 48 * 60 * 60 * 1000) {
      return { kind: "idle" };
    }
  }

  return null;
}

function buildPrePeak(args: {
  peakWindow?: HourWindow | null;
  topTrigger?: string | null;
  plans?: TriggerPlan[];
}): NudgeDecision {
  const trigger = args.topTrigger ?? undefined;
  const plan =
    trigger && args.plans
      ? args.plans.find((p) => p.trigger === trigger)?.plan
      : undefined;
  return {
    kind: "pre_peak",
    peakWindow: args.peakWindow ?? undefined,
    topTrigger: trigger,
    plan,
  };
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  client = new OpenAI({ apiKey });
  return client;
}

export type NudgeUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export async function generateNudgeMessage(args: {
  decision: NudgeDecision;
  displayName: string;
  streakDays: number;
  reasons: string | null;
  persona: Persona;
}): Promise<{ message: string; usage: NudgeUsage }> {
  const ctx: string[] = [
    `User: ${args.displayName}`,
    `Days smoke-free: ${args.streakDays}`,
  ];
  if (args.reasons) ctx.push(`Their reasons: "${args.reasons}"`);

  let situation: string;
  switch (args.decision.kind) {
    case "milestone_hit":
      situation = `Today they hit ${args.decision.milestoneDays} days — celebrate it.`;
      break;
    case "milestone_coming":
      situation = `Tomorrow they hit ${args.decision.milestoneDays} days — build anticipation.`;
      break;
    case "idle":
      situation = `They haven't talked to you in a while — check in warmly without pressure.`;
      break;
    case "pre_peak": {
      const win = args.decision.peakWindow;
      const winStr = win
        ? `${fmtHour(win.startHour)}–${fmtHour(win.endHour)}`
        : "right around now";
      const trig = args.decision.topTrigger
        ? `their top trigger is "${args.decision.topTrigger}"`
        : "they don't have a specific trigger logged";
      const planLine = args.decision.plan
        ? ` Their own pre-committed plan is: "${args.decision.plan}". Echo this plan in your own words — do NOT invent a different one.`
        : " They don't have an if-then plan yet — suggest writing one at /app/cravings as the next step.";
      situation = `Their personal craving peak window is starting (${winStr}); ${trig}.${planLine} Lead with "you're heading into" or similar. Stay calm, no alarm.`;
      break;
    }
    case "relapse_risk": {
      const r = args.decision.risk!;
      const signals: string[] = [];
      if (r.reasons.includes("withdrawal_window"))
        signals.push("they're in the toughest physical withdrawal window (days 1-4)");
      if (r.reasons.includes("craving_cluster"))
        signals.push("they've logged several cravings in the past day");
      if (r.reasons.includes("recent_high_intensity"))
        signals.push("their most recent craving was a strong one (4+/5)");
      if (r.reasons.includes("weekend_evening"))
        signals.push("it's a weekend evening — historically a high-risk window");
      if (r.peakWindow)
        signals.push(
          `their personal peak craving window is around ${fmtHour(r.peakWindow.startHour)}–${fmtHour(r.peakWindow.endHour)}`,
        );
      situation = `Risk read is elevated: ${signals.join("; ")}. Reach out like a friend who noticed — name ONE concrete suggestion for the next few hours (a walk, water, the breathing exercise at /app/breathe). Do NOT alarm them or lecture. Do NOT list the signals back.`;
      break;
    }
  }

  const toneHints = args.persona.tone.map((t) => `- ${t}`).join("\n");

  const prompt = `${args.persona.intro} You're reaching out PROACTIVELY (the user did not message you first).

${ctx.join("\n")}

Situation: ${situation}

VOICE:
${toneHints}

Write a SHORT (1-2 sentences) opener. Rules:
- Don't introduce yourself or say who you are — they know.
- No hype or exclamation overload (cheerleaders may use one).
- If celebrating a milestone, name the number once.
- If idle, ask one specific question rather than a generic "how are you".`;

  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 150,
    temperature: args.persona.temperature ?? 0.8,
    messages: [{ role: "user", content: prompt }],
  });

  return {
    message:
      response.choices[0]?.message?.content?.trim() ??
      "Just thinking of you. How's today going?",
    usage: {
      model: MODEL,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
