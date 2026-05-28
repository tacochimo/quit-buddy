import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

// Bonus added to the daily coach message cap for 7 days after a referral
// qualifies. Kept small so the cost stays bounded.
export const REFERRAL_BONUS_MSGS_PER_DAY = 5;
const BONUS_DAYS = 7;

// Code format: 4-letter base + dash + 4-char unique suffix, like "DYNA-7K9P".
// Readable on phone, hard to mistype, ~17M combinations is plenty.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
function randomSuffix(len: number): string {
  let s = "";
  for (let i = 0; i < len; i += 1) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

function codeFromName(displayName: string | null | undefined): string {
  const cleaned = (displayName ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  return `${cleaned}-${randomSuffix(4)}`;
}

export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.referral_code) return profile.referral_code;

  // Try a handful of candidate codes in case of collision on the unique index.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = codeFromName(profile?.display_name);
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: candidate })
      .eq("id", userId);
    if (!error) return candidate;
    // 23505 = unique violation. Anything else is a real error.
    if (!/duplicate|unique/i.test(error.message)) {
      console.error("[referral] code update failed:", error);
      return null;
    }
  }
  return null;
}

export async function findReferrerByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ id: string; display_name: string | null } | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned || cleaned.length > 32) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("referral_code", cleaned)
    .maybeSingle();
  return data ?? null;
}

// Called when a user completes onboarding. Records the referral as qualified
// and grants both sides the bonus_messages window + a 🤝 referral star.
// Idempotent: re-running for the same referee is a no-op (unique constraint).
export async function applyQualifiedReferral(
  refereeId: string,
  refCode: string,
): Promise<void> {
  const admin = createAdminClient();

  const referrer = await findReferrerByCode(admin, refCode);
  if (!referrer) return;
  if (referrer.id === refereeId) return; // can't refer yourself

  // Insert referral row; unique on referee_id makes this idempotent.
  const { error: insertErr } = await admin.from("referrals").insert({
    referrer_id: referrer.id,
    referee_id: refereeId,
    status: "qualified",
    qualified_at: new Date().toISOString(),
  });
  if (insertErr) {
    // Duplicate = already qualified; treat silently.
    if (!/duplicate|unique/i.test(insertErr.message)) {
      console.error("[referral] insert failed:", insertErr);
    }
    return;
  }

  const bonusUntil = new Date(
    Date.now() + BONUS_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Grant rewards to both sides.
  await Promise.all([
    admin
      .from("profiles")
      .update({
        referred_by: referrer.id,
        bonus_messages_until: bonusUntil,
      })
      .eq("id", refereeId),
    admin
      .from("profiles")
      .update({ bonus_messages_until: bonusUntil })
      .eq("id", referrer.id),
    admin.from("stars").insert([
      { user_id: referrer.id, kind: `referral_${refereeId}`, channel_id: null },
      { user_id: refereeId, kind: `referral_${referrer.id}`, channel_id: null },
    ]),
  ]);
}

export function bonusMessagesActive(bonusUntil: string | null): boolean {
  if (!bonusUntil) return false;
  return new Date(bonusUntil).getTime() > Date.now();
}
