"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveTimezone(tz: string) {
  if (!tz || tz.length > 64) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id);
}
