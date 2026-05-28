"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";

type ActionResult = { error: string } | undefined;

const MAX_PLANS = 10;

export async function saveTriggerPlan(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const trigger = String(formData.get("trigger") ?? "").trim().slice(0, 64);
  const plan = String(formData.get("plan") ?? "").trim().slice(0, 280);

  if (!trigger) return { error: "Pick a trigger." };
  if (!plan) return { error: "Write what you'll do." };

  // Enforce plan cap before inserting a new trigger.
  const { count } = await supabase
    .from("trigger_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data: existing } = await supabase
    .from("trigger_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("trigger", trigger)
    .maybeSingle();
  if (!existing && (count ?? 0) >= MAX_PLANS) {
    return { error: `You can have up to ${MAX_PLANS} plans. Delete one first.` };
  }

  const { error } = await supabase.from("trigger_plans").upsert(
    {
      user_id: user.id,
      trigger,
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,trigger" },
  );
  if (error) return { error: error.message };
  track("plan_saved", user.id, { trigger });
  revalidatePath("/app/cravings");
  revalidatePath("/app/home");
}

export async function deleteTriggerPlan(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  const { error } = await supabase
    .from("trigger_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/cravings");
  revalidatePath("/app/home");
}
