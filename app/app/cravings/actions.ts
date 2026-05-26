"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("cravings")
    .insert({ user_id: user.id, intensity, trigger, note });
  if (error) return { error: error.message };

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
