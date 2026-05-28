import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "plus";

export const COACH_DAILY_LIMITS: Record<Tier, number> = {
  free: 5,
  plus: 30,
};

export function coachDailyLimit(tier: Tier): number {
  return COACH_DAILY_LIMITS[tier];
}

// Reads the caller's tier from their profile. Defaults to 'free' if the
// column is missing (legacy) or the row isn't returned.
export async function getTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<Tier> {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  const raw = data?.subscription_tier;
  return raw === "plus" ? "plus" : "free";
}
