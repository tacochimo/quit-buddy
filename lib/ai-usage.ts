import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

// Per-user monthly budget. Default $0.50/month is generous on gpt-4o-mini
// (~5000 coach turns). Set COACH_MONTHLY_BUDGET_USD=0 to disable enforcement.
export function getMonthlyBudgetUsd(): number {
  const raw = process.env.COACH_MONTHLY_BUDGET_USD;
  if (raw === undefined) return 0.5;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.5;
}

function startOfUtcMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getMonthlyCostUsd(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("ai_usage")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", startOfUtcMonthIso());
  return (data ?? []).reduce(
    (sum, r: { cost_usd: number | string | null }) =>
      sum + Number(r.cost_usd ?? 0),
    0,
  );
}

// Prices per 1M tokens in USD. Update when OpenAI changes them.
// Falls back to zero cost for unknown models so usage still gets logged.
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

export function calcCost(args: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const prices = MODEL_PRICES[args.model] ?? { input: 0, output: 0 };
  const cost =
    (args.promptTokens / 1_000_000) * prices.input +
    (args.completionTokens / 1_000_000) * prices.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export type UsageRecord = {
  userId: string;
  source: "coach" | "nudge";
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export async function recordUsage(record: UsageRecord) {
  const admin = createAdminClient();
  const cost = calcCost(record);
  const { error } = await admin.from("ai_usage").insert({
    user_id: record.userId,
    source: record.source,
    model: record.model,
    prompt_tokens: record.promptTokens,
    completion_tokens: record.completionTokens,
    cost_usd: cost,
  });
  if (error) console.error("[ai-usage] insert failed:", error);
}
