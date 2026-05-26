"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export async function sendSOS(note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmedNote = note.trim().slice(0, 280);

  const { data: signals, error } = await supabase.rpc("send_sos", {
    note: trimmedNote || null,
  });
  if (error) return { error: error.message };

  // Notify every channel-mate (excluding self). Use admin client to bypass RLS
  // when looking up names + members across all the user's channels.
  const admin = createAdminClient();

  const { data: senderProfile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const senderName = senderProfile?.display_name ?? "A friend";

  const channelIds =
    (signals as { id: string; channel_id: string }[] | null)?.map(
      (s) => s.channel_id,
    ) ?? [];

  if (channelIds.length > 0) {
    const { data: channels } = await admin
      .from("channels")
      .select("id, name")
      .in("id", channelIds);
    const channelNameById = new Map(
      (channels ?? []).map((c) => [c.id, c.name as string]),
    );

    const { data: peers } = await admin
      .from("channel_members")
      .select("channel_id, user_id")
      .in("channel_id", channelIds);

    const targets = (peers ?? []).filter((p) => p.user_id !== user.id);

    await Promise.all(
      targets.map((p) =>
        sendPushToUser(p.user_id, {
          title: `🆘 ${senderName} needs support`,
          body: trimmedNote
            ? `"${trimmedNote}" — in ${channelNameById.get(p.channel_id) ?? "your channel"}`
            : `Cheer them in ${channelNameById.get(p.channel_id) ?? "your channel"}`,
          url: `/app/channels/${p.channel_id}`,
          tag: `sos-${p.channel_id}`,
        }).catch((e) => console.error("[sos] push failed:", e)),
      ),
    );
  }

  revalidatePath("/app/home");
  return { sentToChannels: channelIds.length };
}

export async function resolveSOS() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("sos_signals")
    .update({ resolved_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("resolved_at", null);
  if (error) return { error: error.message };

  revalidatePath("/app/home");
}
