import OpenAI from "openai";
import type { StreakState } from "./streak";
import type { Persona } from "./personas";
import type { RelapseRisk } from "./relapse-risk";
import { fmtHour } from "./craving-insights";

const MILESTONE_DAYS = [1, 7, 30, 90, 180, 365];

export type NudgeKind =
  | "idle"
  | "milestone_coming"
  | "milestone_hit"
  | "relapse_risk";

export type NudgeDecision = {
  kind: NudgeKind;
  milestoneDays?: number;
  risk?: RelapseRisk;
};

export function decideNudge(args: {
  streak: StreakState;
  lastNudgeAt: Date | null;
  lastChatAt: Date | null;
  risk?: RelapseRisk;
  now?: Date;
}): NudgeDecision | null {
  const now = args.now ?? new Date();

  // Skip if we nudged within the last 22h. Lets daily cron drift a bit.
  if (args.lastNudgeAt) {
    const sinceMs = now.getTime() - args.lastNudgeAt.getTime();
    if (sinceMs < 22 * 60 * 60 * 1000) return null;
  }

  // Only nudge users on an active streak — don't push someone who just relapsed.
  if (args.streak.kind !== "quit") return null;
  const days = args.streak.days;

  // Just-hit a milestone today — celebrate. (Highest priority.)
  if (MILESTONE_DAYS.includes(days)) {
    return { kind: "milestone_hit", milestoneDays: days };
  }

  // Day before a milestone — anticipation.
  const coming = MILESTONE_DAYS.find((m) => m - days === 1);
  if (coming) return { kind: "milestone_coming", milestoneDays: coming };

  // Relapse risk — proactive reach-out before idle check-in. Only when risk
  // is meaningfully elevated AND the user hasn't chatted in 24h (don't pile
  // onto an active conversation).
  if (args.risk && args.risk.level !== "low") {
    const lastChat = args.lastChatAt?.getTime() ?? 0;
    if (now.getTime() - lastChat > 24 * 60 * 60 * 1000) {
      return { kind: "relapse_risk", risk: args.risk };
    }
  }

  // Idle check-in: streak >= 2 and no coach chat in 48h.
  if (days >= 2) {
    const lastChat = args.lastChatAt?.getTime() ?? 0;
    if (now.getTime() - lastChat > 48 * 60 * 60 * 1000) {
      return { kind: "idle" };
    }
  }

  return null;
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
