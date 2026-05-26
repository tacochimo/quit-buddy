"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePushSubscription(args: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: args.endpoint,
      user_id: user.id,
      p256dh: args.p256dh,
      auth: args.auth,
      user_agent: args.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
}
