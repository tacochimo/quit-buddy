"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const quitDateStr = String(formData.get("quit_date") ?? "");
  const baselineCigs = Number(formData.get("baseline_cigs_per_day") ?? 0);
  const costPerPack = Number(formData.get("cost_per_pack") ?? 0);
  const cigsPerPack = Number(formData.get("cigs_per_pack") ?? 20);
  const reasons = String(formData.get("reasons") ?? "").trim().slice(0, 500);

  if (displayName.length < 1 || displayName.length > 50) {
    return { error: "Display name must be 1–50 characters." };
  }
  if (!quitDateStr || baselineCigs <= 0 || costPerPack <= 0) {
    return { error: "All fields are required." };
  }

  const newQuitDate = new Date(quitDateStr);

  // Read existing quit_date to decide whether we need a new streak event.
  const { data: profile } = await supabase
    .from("profiles")
    .select("quit_date")
    .eq("id", user.id)
    .single();

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      quit_date: newQuitDate.toISOString(),
      baseline_cigs_per_day: baselineCigs,
      cost_per_pack: costPerPack,
      cigs_per_pack: cigsPerPack,
      reasons: reasons || null,
    })
    .eq("id", user.id);
  if (updateErr) return { error: updateErr.message };

  // If the quit date moved, log a fresh "quit" event so the streak math reflects it.
  if (
    profile?.quit_date &&
    new Date(profile.quit_date).toISOString() !== newQuitDate.toISOString()
  ) {
    await supabase.from("streak_events").insert({
      user_id: user.id,
      type: "quit",
      occurred_at: newQuitDate.toISOString(),
    });
  }

  revalidatePath("/app/home");
  redirect("/app/home");
}
