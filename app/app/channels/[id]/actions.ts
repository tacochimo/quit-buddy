"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendCheer(channelId: string, toUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (toUserId === user.id) return { error: "Can't cheer yourself." };

  const { error } = await supabase.from("reactions").insert({
    channel_id: channelId,
    from_user_id: user.id,
    to_user_id: toUserId,
    emoji: "👏",
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/channels/${channelId}`);
}
