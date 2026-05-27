"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT ?? 30);

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// Used by the coach page header to render "X/N left today". Reads the
// authoritative counter (coach_quota_daily) — refunds on failed generations
// decrement it, so chat_messages count would overstate usage.
export async function getCoachUsage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { used: 0, limit: DAILY_LIMIT };

  const { data } = await supabase
    .from("coach_quota_daily")
    .select("used")
    .eq("user_id", user.id)
    .eq("day", utcToday())
    .maybeSingle();

  return { used: data?.used ?? 0, limit: DAILY_LIMIT };
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
