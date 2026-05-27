"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidStepId } from "@/lib/prep";

export async function togglePrepStep(stepId: string, completed: boolean) {
  if (!isValidStepId(stepId)) return { error: "Unknown step." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (completed) {
    const { error } = await supabase
      .from("prep_steps")
      .upsert(
        { user_id: user.id, step_id: stepId },
        { onConflict: "user_id,step_id" },
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("prep_steps")
      .delete()
      .eq("user_id", user.id)
      .eq("step_id", stepId);
    if (error) return { error: error.message };
  }
  revalidatePath("/app/home");
}
