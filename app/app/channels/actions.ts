"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";

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

  // Retry on the very rare invite-code collision.
  let channelId: string | null = null;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("channels")
      .insert({
        name,
        invite_code: code,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!error && data) {
      channelId = data.id;
      break;
    }
    lastErr = error?.message ?? "unknown";
    // 23505 = unique_violation — retry with a new code.
    if (error?.code !== "23505") break;
  }

  if (!channelId) {
    return { error: `Could not create channel: ${lastErr}` };
  }

  // Owner membership.
  const { error: memberErr } = await supabase.from("channel_members").insert({
    channel_id: channelId,
    user_id: user.id,
    role: "owner",
  });
  if (memberErr) return { error: memberErr.message };

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
