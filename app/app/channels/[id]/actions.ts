"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export async function leaveChannel(channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("channel_members")
    .delete()
    .eq("channel_id", channelId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  redirect("/app/home");
}

export async function deleteChannel(channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already enforces owner-only delete on channels; rows cascade.
  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId);
  if (error) return { error: error.message };

  redirect("/app/home");
}

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

  // Notify the cheered user. Fire-and-forget; never block the action on it.
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const { data: channel } = await supabase
    .from("channels")
    .select("name")
    .eq("id", channelId)
    .single();

  sendPushToUser(toUserId, {
    title: "👏 You got a cheer",
    body: `${senderProfile?.display_name ?? "Someone"} cheered you in ${
      channel?.name ?? "your channel"
    }`,
    url: `/app/channels/${channelId}`,
    tag: `cheer-${channelId}`,
  }).catch((e) => console.error("[cheer] push failed:", e));

  revalidatePath(`/app/channels/${channelId}`);
}
