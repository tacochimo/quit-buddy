import OpenAI from "openai";
import type { StreakState } from "./streak";

const MILESTONE_DAYS = [1, 7, 30, 90, 180, 365];

export type NudgeKind = "idle" | "milestone_coming" | "milestone_hit";
export type NudgeDecision = {
  kind: NudgeKind;
  milestoneDays?: number;
};

export function decideNudge(args: {
  streak: StreakState;
  lastNudgeAt: Date | null;
  lastChatAt: Date | null;
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

  // Just-hit a milestone today — celebrate.
  if (MILESTONE_DAYS.includes(days)) {
    return { kind: "milestone_hit", milestoneDays: days };
  }

  // Day before a milestone — anticipation.
  const coming = MILESTONE_DAYS.find((m) => m - days === 1);
  if (coming) return { kind: "milestone_coming", milestoneDays: coming };

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
  }

  const prompt = `You are Quit Buddy, an empathetic quit-smoking coach. You're reaching out PROACTIVELY (the user did not message you first).

${ctx.join("\n")}

Situation: ${situation}

Write a SHORT (1-2 sentences) opener. Rules:
- Don't introduce yourself or say "this is your coach" — they know.
- Sound like a friend texting, not a corporate notification.
- No hype or exclamation overload.
- If celebrating a milestone, name the number once.
- If idle, ask one specific question rather than a generic "how are you".`;

  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 150,
    temperature: 0.8,
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
