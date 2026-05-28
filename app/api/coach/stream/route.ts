import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type CoachContext, generateCoachReplyStream } from "@/lib/coach";
import { computeSavings, computeStreak } from "@/lib/streak";
import { getPersona } from "@/lib/personas";
import { computeInsights, insightsForCoach } from "@/lib/craving-insights";
import {
  getMonthlyBudgetUsd,
  getMonthlyCostUsd,
  recordUsage,
} from "@/lib/ai-usage";
import { getRecentSlipContext } from "@/lib/slip-context";
import { getTriggerPlans } from "@/lib/trigger-plans";
import { getRecentMood } from "@/lib/mood";
import { coachDailyLimit, getTier } from "@/lib/subscription";
import { getActiveRewards } from "@/lib/spin";
import { getLocalNow } from "@/lib/timezone";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse + validate input.
  let message: string;
  try {
    const body = await request.json();
    message = String(body?.message ?? "")
      .trim()
      .slice(0, 1000);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (message.length < 1) {
    return NextResponse.json({ error: "Type a message first." }, { status: 400 });
  }

  // Monthly $ budget — checked first because it's a hard ceiling regardless
  // of remaining daily slots.
  const budget = getMonthlyBudgetUsd();
  if (budget > 0) {
    const spent = await getMonthlyCostUsd(supabase, user.id);
    if (spent >= budget) {
      return NextResponse.json(
        {
          error: `You've reached your $${budget.toFixed(2)} monthly AI budget (used $${spent.toFixed(4)}). Resets on the 1st UTC.`,
        },
        { status: 429 },
      );
    }
  }

  const tier = await getTier(supabase, user.id);
  // Look up the user's tz so daily-spin bonuses align to their local day.
  const { data: tzRow } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const today =
    getLocalNow(tzRow?.timezone ?? null)?.date ??
    new Date().toISOString().slice(0, 10);
  const rewards = await getActiveRewards(supabase, user.id, today);
  const dailyLimit = coachDailyLimit(tier) + rewards.bonusMessages;

  // Atomic daily-quota reservation. Returns the new used count, or null if
  // already at limit. Race-free under concurrent requests.
  const { data: quotaUsed, error: quotaErr } = await supabase.rpc(
    "consume_coach_quota",
    { p_limit: dailyLimit },
  );
  if (quotaErr) {
    console.error("[coach/stream] consume_coach_quota:", quotaErr);
    return NextResponse.json({ error: "quota_error" }, { status: 500 });
  }
  if (quotaUsed === null) {
    return NextResponse.json(
      {
        error:
          tier === "free"
            ? `You've used your ${dailyLimit} free coach messages for today. Upgrade to Plus for ${coachDailyLimit("plus")} a day.`
            : `You've used your ${dailyLimit} coach messages for today. Resets at UTC midnight.`,
        code: tier === "free" ? "free_limit_reached" : "limit_reached",
      },
      { status: 429 },
    );
  }

  // Load context (profile + latest streak + history + craving patterns + recent slip + plans).
  const [
    profileRes,
    latestRes,
    historyRes,
    cravingsRes,
    recentSlip,
    triggerPlans,
    recentMood,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons, coach_persona, timezone",
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("streak_events")
        .select("type, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("cravings")
        .select("intensity, trigger, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      getRecentSlipContext(supabase, user.id),
      getTriggerPlans(supabase, user.id),
      getRecentMood(supabase, user.id),
    ]);

  const profile = profileRes.data;
  if (!profile) {
    await supabase.rpc("refund_coach_quota");
    return NextResponse.json({ error: "profile_missing" }, { status: 400 });
  }

  const streak = computeStreak(
    latestRes.data as { type: "quit" | "relapse"; occurred_at: string } | null,
  );
  const days = streak.kind === "quit" ? streak.days : 0;
  const savings = computeSavings({
    days,
    cigsPerDay: profile.baseline_cigs_per_day,
    costPerPack: profile.cost_per_pack,
    cigsPerPack: profile.cigs_per_pack,
  });

  const cravingInsights = insightsForCoach(
    computeInsights(cravingsRes.data ?? [], {
      tz: profile.timezone ?? null,
    }),
  );

  const context: CoachContext = {
    displayName: profile.display_name,
    streakDays: days,
    isRelapsed: streak.kind === "relapse",
    reasons: profile.reasons,
    cigsPerDay: profile.baseline_cigs_per_day,
    moneySaved: savings.moneySaved,
    persona: getPersona(profile.coach_persona),
    cravingInsights,
    recentSlip,
    triggerPlans,
    recentMood,
  };

  const history = (historyRes.data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  track("coach_message_sent", user.id, {
    tier,
    daily_used: quotaUsed,
    daily_limit: dailyLimit,
    has_bonus_messages: rewards.bonusMessages > 0,
  });

  // Persist the user message up front so a mid-stream disconnect doesn't
  // lose it. Assistant row is inserted at stream end (or never, on error).
  const { data: userRow, error: userInsertErr } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: message })
    .select("id")
    .single();
  if (userInsertErr || !userRow) {
    console.error("[coach/stream] user insert:", userInsertErr);
    await supabase.rpc("refund_coach_quota");
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  // Stream the reply. Persist assistant row + record usage once complete.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientGone = false;
      try {
        const result = await generateCoachReplyStream({
          context,
          history,
          userMessage: message,
          onText: (chunk) => {
            if (clientGone) return;
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              clientGone = true;
            }
          },
        });

        // Persist assistant reply even if client disconnected — refresh will
        // show it. Refund quota only if generation produced nothing.
        if (result.reply.trim().length === 0) {
          await supabase.rpc("refund_coach_quota");
        } else {
          const { error: insertErr } = await supabase
            .from("chat_messages")
            .insert({
              user_id: user.id,
              role: "assistant",
              content: result.reply,
            });
          if (insertErr) console.error("[coach/stream] assistant insert:", insertErr);
        }

        await recordUsage({
          userId: user.id,
          source: "coach",
          model: result.usage.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        });

        if (!clientGone) controller.close();
      } catch (e) {
        console.error("[coach/stream] generation error:", e);
        // Generation failed entirely — refund the quota slot we reserved.
        await supabase.rpc("refund_coach_quota");
        if (!clientGone) controller.error(e);
      }
    },
    cancel() {
      // Client aborted (e.g. Stop button or navigation). Generation in
      // start() continues so the reply is still persisted.
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
