import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type CoachContext, generateCoachReplyStream } from "@/lib/coach";
import { computeSavings, computeStreak } from "@/lib/streak";
import { getPersona } from "@/lib/personas";
import {
  getMonthlyBudgetUsd,
  getMonthlyCostUsd,
  recordUsage,
} from "@/lib/ai-usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT ?? 30);

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

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

  // Daily message cap.
  const { count: usedToday } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", startOfUtcDayIso());
  if ((usedToday ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `You've used your ${DAILY_LIMIT} coach messages for today. Resets at UTC midnight.`,
      },
      { status: 429 },
    );
  }

  // Monthly $ budget.
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

  // Load context (profile + latest streak + history).
  const [profileRes, latestRes, historyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons, coach_persona",
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
  ]);

  const profile = profileRes.data;
  if (!profile) {
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

  const context: CoachContext = {
    displayName: profile.display_name,
    streakDays: days,
    isRelapsed: streak.kind === "relapse",
    reasons: profile.reasons,
    cigsPerDay: profile.baseline_cigs_per_day,
    moneySaved: savings.moneySaved,
    persona: getPersona(profile.coach_persona),
  };

  const history = (historyRes.data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream the reply. Persist + record usage once the stream completes.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await generateCoachReplyStream({
          context,
          history,
          userMessage: message,
          onText: (chunk) => {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              // client disconnected — stop pushing chunks.
            }
          },
        });

        const { error: insertErr } = await supabase
          .from("chat_messages")
          .insert([
            { user_id: user.id, role: "user", content: message },
            { user_id: user.id, role: "assistant", content: result.reply },
          ]);
        if (insertErr) console.error("[coach/stream] insert:", insertErr);

        await recordUsage({
          userId: user.id,
          source: "coach",
          model: result.usage.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        });

        controller.close();
      } catch (e) {
        console.error("[coach/stream] generation error:", e);
        controller.error(e);
      }
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
