"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const quitDateStr = String(formData.get("quit_date") ?? "");
  const baselineCigs = Number(formData.get("baseline_cigs_per_day") ?? 0);
  const costPerPack = Number(formData.get("cost_per_pack") ?? 0);
  const cigsPerPack = Number(formData.get("cigs_per_pack") ?? 20);
  const reasons = String(formData.get("reasons") ?? "").trim().slice(0, 500);

  if (!quitDateStr || baselineCigs <= 0 || costPerPack <= 0) {
    return { error: "Please fill in all fields with valid numbers." };
  }

  const quitDate = new Date(quitDateStr);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      quit_date: quitDate.toISOString(),
      baseline_cigs_per_day: baselineCigs,
      cost_per_pack: costPerPack,
      cigs_per_pack: cigsPerPack,
      reasons: reasons || null,
    })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  // First streak event so the counter has something to anchor on.
  const { error: eventError } = await supabase.from("streak_events").insert({
    user_id: user.id,
    type: "quit",
    occurred_at: quitDate.toISOString(),
  });

  if (eventError) return { error: eventError.message };

  redirect("/app/home");
}
