"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MILESTONES, milestoneKind } from "@/lib/streak";

async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function restartStreak() {
  const { supabase, user } = await getUserOrRedirect();

  const { error } = await supabase.from("streak_events").insert({
    user_id: user.id,
    type: "quit",
    occurred_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/app/home");
}

// Awards any milestone stars the user has earned but doesn't have yet.
// Check-then-insert keeps it safe against the partial unique index in 0001.
export async function awardMilestoneStars(streakDays: number) {
  const { supabase, user } = await getUserOrRedirect();

  const earnedKinds = MILESTONES.filter((m) => streakDays >= m).map(
    milestoneKind,
  );
  if (earnedKinds.length === 0) return;

  const { data: existing } = await supabase
    .from("stars")
    .select("kind")
    .eq("user_id", user.id)
    .is("channel_id", null)
    .in("kind", earnedKinds);

  const have = new Set((existing ?? []).map((s) => s.kind));
  const toInsert = earnedKinds
    .filter((k) => !have.has(k))
    .map((kind) => ({ user_id: user.id, kind, channel_id: null }));

  if (toInsert.length > 0) {
    await supabase.from("stars").insert(toInsert);
  }
}
