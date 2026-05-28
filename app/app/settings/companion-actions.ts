"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCompanionId } from "@/lib/companions";
import { track } from "@/lib/analytics";

export async function setCompanion(value: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const next = value === null || value === "" ? null : isCompanionId(value) ? value : null;
  if (value && value !== "" && next === null) {
    return { error: "Unknown companion." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ companion: next })
    .eq("id", user.id);
  if (error) return { error: error.message };
  track("companion_changed", user.id, { companion: next });
  revalidatePath("/app/settings");
  revalidatePath("/app/coach");
}
