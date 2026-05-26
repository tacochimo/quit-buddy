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

  // Insert user message first so it shows up even if the API call fails.
  const { error: userInsertErr } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: trimmed });
  if (userInsertErr) return { error: userInsertErr.message };

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
    const msg = (e as Error).message ?? "unknown";
    console.error("[coach] generation failed:", msg);
    revalidatePath("/app/coach");
    return { error: `Coach couldn't reply: ${msg}` };
  }

  await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "assistant", content: reply });

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
