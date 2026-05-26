"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type CoachContext,
  generateCoachReply,
} from "@/lib/coach";
import { computeSavings, computeStreak } from "@/lib/streak";

export async function sendCoachMessage(message: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = message.trim().slice(0, 1000);
  if (trimmed.length < 1) return { error: "Type a message first." };

  // Build context from profile + latest streak event.
  const [profileRes, latestRes, historyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons",
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
  if (!profile) return { error: "Profile not found." };

  const streak = computeStreak(
    latestRes.data as
      | { type: "quit" | "relapse"; occurred_at: string }
      | null,
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
  };

  // Call OpenAI first. Only persist messages on success — keeps the chat
  // history clean when billing/quota/timeout errors hit.
  let reply: string;
  try {
    reply = await generateCoachReply({
      context,
      history: (historyRes.data ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      userMessage: trimmed,
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("[coach] generation failed:", err);

    if (err.status === 429) {
      return {
        error:
          "Coach is paused: OpenAI account needs billing or a higher rate limit. Add a payment method at platform.openai.com/settings/organization/billing.",
      };
    }
    if (err.status === 401) {
      return { error: "Coach is paused: OPENAI_API_KEY is missing or invalid." };
    }
    return {
      error: `Coach couldn't reply (${err.status ?? "network"}): ${err.message ?? "unknown error"}`,
    };
  }

  // Insert user + assistant atomically (best-effort — Supabase doesn't do real
  // tx, but back-to-back inserts are fine for a 2-row case).
  const { error: insertErr } = await supabase.from("chat_messages").insert([
    { user_id: user.id, role: "user", content: trimmed },
    { user_id: user.id, role: "assistant", content: reply },
  ]);
  if (insertErr) return { error: insertErr.message };

  revalidatePath("/app/coach");
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
