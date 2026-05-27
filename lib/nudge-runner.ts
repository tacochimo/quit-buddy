import { createAdminClient } from "./supabase/admin";
import { computeStreak } from "./streak";
import { decideNudge, generateNudgeMessage } from "./nudges";
import { sendPushToUser } from "./push";
import { recordUsage } from "./ai-usage";
import { getPersona } from "./personas";
import { computeRelapseRisk } from "./relapse-risk";

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
  const [profileRes, latestRes, lastNudgeRes, lastChatRes, cravingsRes] =
    await Promise.all([
      admin
        .from("profiles")
        .select("display_name, reasons, coach_persona")
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
    ]);

  const profile = profileRes.data;
  if (!profile) return { kind: null, reason: "no_profile" };

  const streak = computeStreak(
    latestRes.data as { type: "quit" | "relapse"; occurred_at: string } | null,
  );

  const risk = computeRelapseRisk({
    streakDays: streak.kind === "quit" ? streak.days : 0,
    cravings: cravingsRes.data ?? [],
  });

  const decision = decideNudge({
    streak,
    lastNudgeAt: lastNudgeRes.data?.sent_at
      ? new Date(lastNudgeRes.data.sent_at)
      : null,
    lastChatAt: lastChatRes.data?.created_at
      ? new Date(lastChatRes.data.created_at)
      : null,
    risk,
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

  // Risk nudges get a softer title — they're proactive ("checking in") not
  // celebratory, so the standard "wrote to you" framing is fine but a
  // distinct prefix helps users distinguish if they look at the lock screen.
  const isRisk = decision.kind === "relapse_risk";
  await sendPushToUser(userId, {
    title: isRisk
      ? "🤝 Your coach is checking in"
      : "🤝 Your coach wrote to you",
    body: message.slice(0, 140),
    url: "/app/coach",
    tag: "coach-nudge",
  });

  return { kind: decision.kind };
}
