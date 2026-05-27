import type { SupabaseClient } from "@supabase/supabase-js";
import type { HourWindow } from "./craving-insights";

export type TriggerPlan = {
  id: string;
  trigger: string;
  plan: string;
  updatedAt: string;
};

export async function getTriggerPlans(
  supabase: SupabaseClient,
  userId: string,
): Promise<TriggerPlan[]> {
  const { data } = await supabase
    .from("trigger_plans")
    .select("id, trigger, plan, updated_at")
    .eq("user_id", userId)
    .order("trigger", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    trigger: r.trigger,
    plan: r.plan,
    updatedAt: r.updated_at,
  }));
}

// True when "now" (local time) lies inside the peak craving window. The
// window may wrap midnight (e.g. 22 → 1).
export function isInPeakWindow(
  peakWindow: HourWindow | null,
  now: Date = new Date(),
): boolean {
  if (!peakWindow) return false;
  const h = now.getHours();
  const { startHour, endHour } = peakWindow;
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

// Lines for the coach system prompt. Empty when the user has no plans.
export function plansForCoach(plans: TriggerPlan[]): string[] {
  if (plans.length === 0) return [];
  const lines = [
    "THEIR OWN IF-THEN PLANS (use these instead of inventing new coping ideas):",
  ];
  for (const p of plans) {
    lines.push(`- When ${p.trigger}, they plan to: "${p.plan}"`);
  }
  return lines;
}

export type PlanEffectiveness = {
  yes: number;
  no: number;
  unused: number;
};

// Aggregates plan_used answers from craving rows, keyed by trigger.
export function effectivenessByTrigger(
  rows: Array<{ trigger: string | null; plan_used: string | null }>,
): Record<string, PlanEffectiveness> {
  const out: Record<string, PlanEffectiveness> = {};
  for (const r of rows) {
    const t = r.trigger;
    const p = r.plan_used;
    if (!t || (p !== "yes" && p !== "no" && p !== "unused")) continue;
    if (!out[t]) out[t] = { yes: 0, no: 0, unused: 0 };
    out[t][p] += 1;
  }
  return out;
}
