"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createChannel(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 50) {
    return { error: "Channel name must be 2–50 characters." };
  }

  const { data: channelId, error } = await supabase.rpc("create_channel", {
    channel_name: name,
  });

  if (error) {
    if (error.message.includes("invalid_name"))
      return { error: "Channel name must be 2–50 characters." };
    if (error.message.includes("not_authenticated")) redirect("/login");
    return { error: error.message };
  }

  redirect(`/app/channels/${channelId}`);
}

export async function joinChannel(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) return { error: "Enter a valid invite code." };

  const { data, error } = await supabase.rpc("join_channel_by_code", { code });

  if (error) {
    if (error.message.includes("invalid_invite_code"))
      return { error: "That invite code doesn't exist." };
    if (error.message.includes("channel_full"))
      return { error: "That channel is full." };
    return { error: error.message };
  }

  redirect(`/app/channels/${data}`);
}
