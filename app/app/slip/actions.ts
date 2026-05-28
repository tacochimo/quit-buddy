"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyBuddyOfRelapse } from "@/lib/buddy";
import { track } from "@/lib/analytics";

export type SlipFormResult = { error: string } | undefined;

export async function recordSlip(formData: FormData): Promise<SlipFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const rawKind = String(formData.get("kind") ?? "slip");
  const kind = rawKind === "relapse" ? "relapse" : "slip";

  const rawCount = formData.get("count");
  const countNum =
    typeof rawCount === "string" && rawCount.trim() !== ""
      ? Math.max(0, Math.min(99, Math.floor(Number(rawCount))))
      : null;

  const trigger =
    String(formData.get("trigger") ?? "")
      .trim()
      .slice(0, 64) || null;

  const rawIntensity = formData.get("intensity");
  const intensityNum =
    typeof rawIntensity === "string" && rawIntensity.trim() !== ""
      ? Math.max(1, Math.min(5, Math.floor(Number(rawIntensity))))
      : null;

  const whatHappening =
    String(formData.get("what_was_happening") ?? "")
      .trim()
      .slice(0, 280) || null;
  const whatNext =
    String(formData.get("what_id_do_differently") ?? "")
      .trim()
      .slice(0, 280) || null;

  let streakEventId: string | null = null;
  if (kind === "relapse") {
    const { data: ev, error: evErr } = await supabase
      .from("streak_events")
      .insert({
        user_id: user.id,
        type: "relapse",
        occurred_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (evErr) return { error: evErr.message };
    streakEventId = ev?.id ?? null;
  }

  const { error: slipErr } = await supabase.from("slips").insert({
    user_id: user.id,
    kind,
    count: kind === "slip" ? countNum : null,
    trigger,
    intensity: intensityNum,
    what_was_happening: whatHappening,
    what_id_do_differently: whatNext,
    streak_event_id: streakEventId,
  });
  if (slipErr) return { error: slipErr.message };

  track("slip_recorded", user.id, {
    kind,
    count: countNum,
    trigger,
    intensity: intensityNum,
  });

  if (kind === "relapse") {
    await notifyBuddyOfRelapse(user.id);
    revalidatePath("/app/home");
    redirect("/app/home");
  }

  revalidatePath("/app/home");
  redirect("/app/coach?from=slip");
}
