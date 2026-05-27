import { createAdminClient } from "./supabase/admin";
import { computeStreak } from "./streak";
import { decideNudge, generateNudgeMessage } from "./nudges";
import { sendPushToUser } from "./push";
import { recordUsage } from "./ai-usage";

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
  const [profileRes, latestRes, lastNudgeRes, lastChatRes] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name, reasons")
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
  ]);

  const profile = profileRes.data;
  if (!profile) return { kind: null, reason: "no_profile" };

  const streak = computeStreak(
    latestRes.data as { type: "quit" | "relapse"; occurred_at: string } | null,
  );

  const decision = decideNudge({
    streak,
    lastNudgeAt: lastNudgeRes.data?.sent_at
      ? new Date(lastNudgeRes.data.sent_at)
      : null,
    lastChatAt: lastChatRes.data?.created_at
      ? new Date(lastChatRes.data.created_at)
      : null,
  });

  if (!decision) return { kind: null, reason: "no_trigger" };

  const { message, usage } = await generateNudgeMessage({
    decision,
    displayName: profile.display_name,
    streakDays: streak.kind === "quit" ? streak.days : 0,
    reasons: profile.reasons,
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
    details: decision.milestoneDays
      ? { milestone_days: decision.milestoneDays }
      : {},
  });

  await sendPushToUser(userId, {
    title: "🤝 Your coach wrote to you",
    body: message.slice(0, 140),
    url: "/app/coach",
    tag: "coach-nudge",
  });

  return { kind: decision.kind };
}
