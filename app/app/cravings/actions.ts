"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyBuddyOfCraving } from "@/lib/buddy";
import { track } from "@/lib/analytics";

export async function logCraving(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const intensity = Math.max(
    1,
    Math.min(5, Number(formData.get("intensity") ?? 3)),
  );
  const trigger = String(formData.get("trigger") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 280) || null;
  const rawPlanUsed = String(formData.get("plan_used") ?? "").trim();
  const planUsed =
    rawPlanUsed === "yes" || rawPlanUsed === "no" || rawPlanUsed === "unused"
      ? rawPlanUsed
      : null;

  const { error } = await supabase
    .from("cravings")
    .insert({
      user_id: user.id,
      intensity,
      trigger,
      note,
      plan_used: planUsed,
    });
  if (error) return { error: error.message };

  // Fire-and-forget buddy ping. Helper handles "no buddy" + threshold.
  await notifyBuddyOfCraving(user.id, intensity);

  track("craving_logged", user.id, {
    intensity,
    trigger,
    has_plan_outcome: planUsed !== null,
    plan_outcome: planUsed,
  });
  if (planUsed === "yes" || planUsed === "no") {
    track("plan_used", user.id, { trigger, outcome: planUsed });
  }

  revalidatePath("/app/cravings");
}

export async function deleteCraving(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("cravings").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/app/cravings");
}
