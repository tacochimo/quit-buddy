"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMood } from "@/lib/mood";
import { getLocalNow } from "@/lib/timezone";

export async function logMood(mood: string) {
  if (!isMood(mood)) return { error: "Unknown mood." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const tz = profile?.timezone ?? null;
  const logDate =
    getLocalNow(tz)?.date ?? new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("mood_logs").upsert(
    { user_id: user.id, log_date: logDate, mood, created_at: new Date().toISOString() },
    { onConflict: "user_id,log_date" },
  );
  if (error) return { error: error.message };
  revalidatePath("/app/home");
}
