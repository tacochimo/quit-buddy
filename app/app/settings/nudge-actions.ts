"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNudges } from "@/lib/nudge-runner";

export async function runMyNudge() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Clear the recent-nudge guard so the test can fire even if cron just ran.
  const admin = createAdminClient();
  await admin.from("nudges_sent").delete().eq("user_id", user.id);

  try {
    const result = await runNudges(admin, { onlyUserId: user.id });
    revalidatePath("/app/coach");
    const decision = result.decisions[0];
    return { kind: decision?.kind ?? null, reason: decision?.reason };
  } catch (e: unknown) {
    return { error: (e as Error).message ?? String(e) };
  }
}
