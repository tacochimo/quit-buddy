"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "@/lib/personas";
import { applyQualifiedReferral } from "@/lib/referral";

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
  const personaInput = String(formData.get("coach_persona") ?? "friend");

  if (!quitDateStr || baselineCigs <= 0 || costPerPack <= 0) {
    return { error: "Please fill in all fields with valid numbers." };
  }

  const quitDate = new Date(quitDateStr);

  const persona: PersonaId =
    personaInput in PERSONAS ? (personaInput as PersonaId) : DEFAULT_PERSONA;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      quit_date: quitDate.toISOString(),
      baseline_cigs_per_day: baselineCigs,
      cost_per_pack: costPerPack,
      cigs_per_pack: cigsPerPack,
      reasons: reasons || null,
      coach_persona: persona,
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

  // If they landed via /?ref=CODE, attribute + grant rewards now that
  // onboarding is complete. Best-effort: never block the redirect.
  try {
    const cookieStore = await cookies();
    const ref = cookieStore.get("qb_ref")?.value;
    if (ref) {
      await applyQualifiedReferral(user.id, ref);
      cookieStore.delete("qb_ref");
    }
  } catch (e) {
    console.error("[onboarding] referral attribution failed:", e);
  }

  redirect("/app/home");
}
