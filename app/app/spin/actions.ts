"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyOutcome, type OutcomeMeta } from "@/lib/spin";
import { getLocalNow } from "@/lib/timezone";

export type SpinResult =
  | { ok: true; outcome: OutcomeMeta; alreadySpun: false }
  | { ok: true; outcome: OutcomeMeta; alreadySpun: true }
  | { ok: false; error: string };

export async function spinToday(): Promise<SpinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, companion")
    .eq("id", user.id)
    .maybeSingle();
  const tz = profile?.timezone ?? null;
  const today =
    getLocalNow(tz)?.date ?? new Date().toISOString().slice(0, 10);

  // Check if today's already been spun.
  const { data: existing } = await supabase
    .from("prize_spins")
    .select("outcome")
    .eq("user_id", user.id)
    .eq("spin_date", today)
    .maybeSingle();

  if (existing) {
    const meta = (await import("@/lib/spin")).OUTCOMES.find(
      (o) => o.id === existing.outcome,
    );
    if (!meta) return { ok: false, error: "Stored outcome not recognized." };
    return { ok: true, outcome: meta, alreadySpun: true };
  }

  const outcome = await applyOutcome(
    supabase,
    user.id,
    today,
    profile?.companion ?? null,
  );
  revalidatePath("/app/spin");
  revalidatePath("/app/home");
  revalidatePath("/app/coach");
  return { ok: true, outcome, alreadySpun: false };
}
