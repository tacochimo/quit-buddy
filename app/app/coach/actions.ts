"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT ?? 30);

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Used by the coach page header to render "X/N left today".
export async function getCoachUsage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { used: 0, limit: DAILY_LIMIT };

  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", startOfUtcDayIso());

  return { used: count ?? 0, limit: DAILY_LIMIT };
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
