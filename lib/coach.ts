import OpenAI from "openai";

// Provider isolation lives here. To swap to Anthropic later, replace this
// module — keep the same exported signature.

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  client = new OpenAI({ apiKey });
  return client;
}

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type CoachContext = {
  displayName: string;
  streakDays: number;
  isRelapsed: boolean;
  reasons: string | null;
  cigsPerDay: number | null;
  moneySaved: number;
};

export function buildSystemPrompt(ctx: CoachContext): string {
  const lines: string[] = [
    "You are Quit Buddy, an empathetic quit-smoking coach.",
    `The user is named ${ctx.displayName}.`,
  ];

  if (ctx.isRelapsed) {
    lines.push(
      "They recently relapsed. Be compassionate. Recovery isn't linear — most quitters need 6-30 attempts. Never shame them.",
    );
  } else if (ctx.streakDays === 0) {
    lines.push("They're on day 0 of a new quit attempt.");
  } else if (ctx.streakDays < 3) {
    lines.push(
      `They're on day ${ctx.streakDays} — the hardest physical withdrawal window. Acknowledge that.`,
    );
  } else if (ctx.streakDays < 30) {
    lines.push(
      `They're on day ${ctx.streakDays}. Past acute withdrawal but cravings are still real.`,
    );
  } else {
    lines.push(
      `They're on day ${ctx.streakDays} — significant progress. Reinforce identity ("you're a non-smoker now") over willpower.`,
    );
  }

  if (ctx.reasons) {
    lines.push(`Their reasons for quitting: "${ctx.reasons}"`);
    lines.push(
      "Use these reasons sparingly and naturally — don't quote them verbatim every reply.",
    );
  }

  if (ctx.moneySaved > 0) {
    lines.push(
      `They've saved $${ctx.moneySaved.toFixed(2)} so far by not smoking ${ctx.cigsPerDay ?? "their usual"} cigs/day.`,
    );
  }

  lines.push(
    "",
    "RULES:",
    "- Keep responses SHORT: 1-3 sentences, max 4 in a crisis.",
    "- Validate feelings first, then offer a concrete small action.",
    "- Never suggest they smoke even one. Never recommend nicotine.",
    "- If they mention craving NOW, mention the breathing exercise at /app/breathe and the SOS button.",
    "- If they slipped, frame compassionately and help them restart.",
    "- Don't lecture. Don't pile on tips. Pick the most useful one.",
    "- Speak like a trusted friend, not a doctor.",
  );

  return lines.join("\n");
}

export async function generateCoachReply(args: {
  context: CoachContext;
  history: ChatMessage[];
  userMessage: string;
}): Promise<string> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 250,
    temperature: 0.7,
    messages: [
      { role: "system", content: buildSystemPrompt(args.context) },
      ...args.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: args.userMessage },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "I'm here. Tell me more about what's going on."
  );
}
