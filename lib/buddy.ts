// Server-side helpers for the 1:1 buddy ("accountability partner") feature.
// notify* functions are fire-and-forget: never throw into the caller's path
// because we don't want a buddy push failure to abort logging a craving or
// a relapse.

import { createAdminClient } from "./supabase/admin";
import { sendPushToUser } from "./push";

// Returns the calling user's buddy's user_id, or null. Uses the admin client
// so we can call it from server actions without re-deriving auth context —
// caller MUST pass their own validated user id.
export async function getBuddyUserId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("buddy_links")
    .select("inviter_id, invitee_id")
    .eq("status", "accepted")
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
    .maybeSingle();
  if (!data) return null;
  return data.inviter_id === userId ? data.invitee_id : data.inviter_id;
}

async function getDisplayName(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  return data?.display_name ?? "Your buddy";
}

// Soft signal: a craving was logged. Only fires for stronger cravings so
// the buddy isn't pinged for every twinge. Silent-style notification.
export async function notifyBuddyOfCraving(
  fromUserId: string,
  intensity: number,
): Promise<void> {
  if (intensity < 3) return;
  try {
    const buddyId = await getBuddyUserId(fromUserId);
    if (!buddyId) return;
    const name = await getDisplayName(fromUserId);
    await sendPushToUser(buddyId, {
      title: `${name} is having a craving`,
      body:
        intensity >= 4
          ? "A strong one. A short kind message from you would help."
          : "Send a quick word of encouragement if you can.",
      url: "/app/buddy",
      tag: "buddy-craving",
    });
  } catch (e) {
    console.error("[buddy] notifyBuddyOfCraving:", e);
  }
}

// Loud signal: a relapse was logged. This is the highest-stakes moment.
export async function notifyBuddyOfRelapse(fromUserId: string): Promise<void> {
  try {
    const buddyId = await getBuddyUserId(fromUserId);
    if (!buddyId) return;
    const name = await getDisplayName(fromUserId);
    await sendPushToUser(buddyId, {
      title: `${name} slipped`,
      body: "No judgement — just reach out. Most quits take several tries.",
      url: "/app/buddy",
      tag: "buddy-relapse",
    });
  } catch (e) {
    console.error("[buddy] notifyBuddyOfRelapse:", e);
  }
}
