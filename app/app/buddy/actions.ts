"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";

async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Generates a fresh invite code the user can share with one friend. If they
// already have a pending invite out, returns the existing code (no need to
// spawn a second).
export async function inviteBuddy() {
  const { supabase, user } = await getUserOrRedirect();

  // Reject if user already has an accepted buddy.
  const { data: accepted } = await supabase
    .from("buddy_links")
    .select("id")
    .eq("status", "accepted")
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
    .maybeSingle();
  if (accepted) return { error: "You already have a buddy." };

  // Reuse an existing pending invite from this user, if any.
  const { data: existing } = await supabase
    .from("buddy_links")
    .select("invite_code")
    .eq("inviter_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    revalidatePath("/app/buddy");
    return { code: existing.invite_code };
  }

  const code = generateInviteCode(6);
  const { error } = await supabase.from("buddy_links").insert({
    inviter_id: user.id,
    invite_code: code,
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/app/buddy");
  return { code };
}

export async function acceptBuddy(formData: FormData) {
  const { supabase } = await getUserOrRedirect();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) return { error: "Enter a valid invite code." };

  const { error } = await supabase.rpc("accept_buddy", { p_code: code });
  if (error) {
    if (error.message.includes("invalid_or_used_code"))
      return { error: "That code doesn't exist or has already been used." };
    if (error.message.includes("cannot_buddy_yourself"))
      return { error: "You can't be your own buddy." };
    if (error.message.includes("already_has_buddy"))
      return {
        error: "You or the inviter already has a buddy. Remove the existing one first.",
      };
    return { error: error.message };
  }

  revalidatePath("/app/buddy");
  return { ok: true };
}

export async function cancelPendingInvite() {
  const { supabase, user } = await getUserOrRedirect();
  await supabase
    .from("buddy_links")
    .delete()
    .eq("inviter_id", user.id)
    .eq("status", "pending");
  revalidatePath("/app/buddy");
}

export async function removeBuddy() {
  const { supabase } = await getUserOrRedirect();
  const { error } = await supabase.rpc("remove_buddy");
  if (error) return { error: error.message };
  revalidatePath("/app/buddy");
  return { ok: true };
}
