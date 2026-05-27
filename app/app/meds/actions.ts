"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | undefined;

const KINDS = [
  "patch",
  "gum",
  "lozenge",
  "inhaler",
  "spray",
  "varenicline",
  "bupropion",
  "other",
] as const;
const SCHEDULES = ["daily", "twice-daily", "prn"] as const;

export async function addRegimen(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const rawKind = String(formData.get("kind") ?? "");
  const rawSchedule = String(formData.get("schedule") ?? "");
  const rawDose = formData.get("dose_mg");
  const rawStarted = String(formData.get("started_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 280) || null;

  if (!name) return { error: "Name is required." };
  const kind = (KINDS as readonly string[]).includes(rawKind)
    ? rawKind
    : "other";
  const schedule = (SCHEDULES as readonly string[]).includes(rawSchedule)
    ? rawSchedule
    : "prn";
  const doseNum =
    typeof rawDose === "string" && rawDose.trim() !== ""
      ? Math.max(0, Math.min(9999, Number(rawDose)))
      : null;
  const startedOn = /^\d{4}-\d{2}-\d{2}$/.test(rawStarted)
    ? rawStarted
    : new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("med_regimens").insert({
    user_id: user.id,
    name,
    kind,
    schedule,
    dose_mg: doseNum,
    started_on: startedOn,
    notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/meds");
}

export async function endRegimen(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  const { error } = await supabase
    .from("med_regimens")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/meds");
}

export async function logDose(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const regimenId = String(formData.get("regimen_id") ?? "");
  const rawKind = String(formData.get("kind") ?? "dose");
  const kind = rawKind === "skipped" ? "skipped" : "dose";
  const rawCount = formData.get("count");
  const count =
    kind === "dose" && typeof rawCount === "string" && rawCount.trim() !== ""
      ? Math.max(1, Math.min(20, Math.floor(Number(rawCount))))
      : 1;

  const { error } = await supabase.from("med_events").insert({
    user_id: user.id,
    regimen_id: regimenId || null,
    kind,
    count: kind === "dose" ? count : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/meds");
}

export async function logSideEffect(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const regimenId = String(formData.get("regimen_id") ?? "");
  const label = String(formData.get("side_effect") ?? "").trim().slice(0, 64);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 280) || null;
  if (!label) return { error: "Pick or type a side effect." };

  const { error } = await supabase.from("med_events").insert({
    user_id: user.id,
    regimen_id: regimenId || null,
    kind: "side_effect",
    side_effect: label,
    notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/meds");
}
