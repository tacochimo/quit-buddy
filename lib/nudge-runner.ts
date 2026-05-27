import { createAdminClient } from "./supabase/admin";
import { computeStreak } from "./streak";
import { decideNudge, generateNudgeMessage } from "./nudges";
import { sendPushToUser } from "./push";
import { recordUsage } from "./ai-usage";
import { getPersona } from "./personas";
import { computeRelapseRisk } from "./relapse-risk";
import { computeInsights } from "./craving-insights";
import { getTriggerPlans } from "./trigger-plans";
import { getLocalNow } from "./timezone";

export async function runNudges(
  admin: ReturnType<typeof createAdminClient>,
  options: { onlyUserId?: string } = {},
) {
  let userIds: string[];

  if (options.onlyUserId) {
    userIds = [options.onlyUserId];
  } else {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("user_id");
    userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
  }

  const stats = {
    checked: userIds.length,
    nudged: 0,
    skipped: 0,
    failed: 0,
    decisions: [] as { userId: string; kind: string | null; reason?: string }[],
  };

  for (const userId of userIds) {
    try {
      const decisionResult = await nudgeOneUser(admin, userId);
      stats.decisions.push({
        userId,
        kind: decisionResult.kind,
        reason: decisionResult.reason,
      });
      if (decisionResult.kind) stats.nudged++;
      else stats.skipped++;
    } catch (e) {
      console.error(`[nudges] failed for ${userId}:`, e);
      stats.failed++;
    }
  }

  return stats;
}

async function nudgeOneUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ kind: string | null; reason?: string }> {
  const [
    profileRes,
    latestRes,
    lastNudgeRes,
    lastPrePeakRes,
    lastChatRes,
    cravingsRes,
    plans,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name, reasons, coach_persona, timezone")
      .eq("id", userId)
      .single(),
    admin
      .from("streak_events")
      .select("type, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("nudges_sent")
      .select("sent_at")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("nudges_sent")
      .select("sent_at")
      .eq("user_id", userId)
      .eq("kind", "pre_peak")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("cravings")
      .select("intensity, trigger, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    getTriggerPlans(admin, userId),
  ]);

  const profile = profileRes.data;
  if (!profile) return { kind: null, reason: "no_profile" };

  const streak = computeStreak(
    latestRes.data as { type: "quit" | "relapse"; occurred_at: string } | null,
  );

  const cravings = cravingsRes.data ?? [];
  const risk = computeRelapseRisk({
    streakDays: streak.kind === "quit" ? streak.days : 0,
    cravings,
    tz: profile.timezone ?? null,
  });
  const insights = computeInsights(cravings, { tz: profile.timezone ?? null });
  const localNow = getLocalNow(profile.timezone ?? null);

  const decision = decideNudge({
    streak,
    lastNudgeAt: lastNudgeRes.data?.sent_at
      ? new Date(lastNudgeRes.data.sent_at)
      : null,
    lastPrePeakAt: lastPrePeakRes.data?.sent_at
      ? new Date(lastPrePeakRes.data.sent_at)
      : null,
    lastChatAt: lastChatRes.data?.created_at
      ? new Date(lastChatRes.data.created_at)
      : null,
    risk,
    peakWindow: insights.peakWindow,
    topTrigger: insights.topTrigger?.name ?? null,
    plans,
    localNow,
  });

  if (!decision) return { kind: null, reason: "no_trigger" };

  const { message, usage } = await generateNudgeMessage({
    decision,
    displayName: profile.display_name,
    streakDays: streak.kind === "quit" ? streak.days : 0,
    reasons: profile.reasons,
    persona: getPersona(profile.coach_persona),
  });

  await admin.from("chat_messages").insert({
    user_id: userId,
    role: "assistant",
    content: message,
  });

  await recordUsage({
    userId,
    source: "nudge",
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  });

  await admin.from("nudges_sent").insert({
    user_id: userId,
    kind: decision.kind,
    details: {
      ...(decision.milestoneDays
        ? { milestone_days: decision.milestoneDays }
        : {}),
      ...(decision.risk
        ? {
            risk_level: decision.risk.level,
            risk_score: decision.risk.score,
            risk_reasons: decision.risk.reasons,
          }
        : {}),
    },
  });

  // Distinct titles per kind help on the lock screen.
  let title = "🤝 Your coach wrote to you";
  if (decision.kind === "relapse_risk") title = "🤝 Your coach is checking in";
  else if (decision.kind === "pre_peak") title = "⏰ Heads up — peak window";
  await sendPushToUser(userId, {
    title,
    body: message.slice(0, 140),
    url: "/app/coach",
    tag: "coach-nudge",
  });

  return { kind: decision.kind };
}
