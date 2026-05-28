"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { coachDailyLimit, getTier, type Tier } from "@/lib/subscription";
import { REFERRAL_BONUS_MSGS_PER_DAY, bonusMessagesActive } from "@/lib/referral";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// Used by the coach page header to render "X/N left today". Reads the
// authoritative counter (coach_quota_daily) — refunds on failed generations
// decrement it, so chat_messages count would overstate usage.
export async function getCoachUsage(): Promise<{
  used: number;
  limit: number;
  tier: Tier;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { used: 0, limit: coachDailyLimit("free"), tier: "free" };
  }

  const [tier, usageRes, profileRes] = await Promise.all([
    getTier(supabase, user.id),
    supabase
      .from("coach_quota_daily")
      .select("used")
      .eq("user_id", user.id)
      .eq("day", utcToday())
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("bonus_messages_until")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const referralBonus = bonusMessagesActive(
    profileRes.data?.bonus_messages_until ?? null,
  )
    ? REFERRAL_BONUS_MSGS_PER_DAY
    : 0;

  return {
    used: usageRes.data?.used ?? 0,
    limit: coachDailyLimit(tier) + referralBonus,
    tier,
  };
}

export async function clearCoachHistory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("chat_messages").delete().eq("user_id", user.id);
  revalidatePath("/app/coach");
}
