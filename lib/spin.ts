import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANIONS, type CompanionId } from "./companions";

export type Outcome =
  | "bonus_messages"
  | "tricks_unlock"
  | "milestone_star"
  | "sparkle"
  | "companion_swap"
  | "dud";

export type OutcomeMeta = {
  id: Outcome;
  weight: number; // relative
  label: string;
  emoji: string;
  body: string;
  // Hours the effect lasts. Null = instant / no expiry.
  lastsHours: number | null;
};

export const OUTCOMES: OutcomeMeta[] = [
  {
    id: "tricks_unlock",
    weight: 20,
    label: "All tricks unlocked",
    emoji: "✨",
    body: "Your companion knows every trick for the next 24 hours.",
    lastsHours: 24,
  },
  {
    id: "milestone_star",
    weight: 20,
    label: "Bonus star",
    emoji: "⭐",
    body: "A keeper for the wall — added to your stars.",
    lastsHours: null,
  },
  {
    id: "sparkle",
    weight: 20,
    label: "Companion sparkle",
    emoji: "🌟",
    body: "Sparkle aura around your companion for 24 hours.",
    lastsHours: 24,
  },
  {
    id: "companion_swap",
    weight: 20,
    label: "Surprise companion",
    emoji: "🎭",
    body: "A different companion sits with you today.",
    lastsHours: 24,
  },
  {
    id: "bonus_messages",
    weight: 15,
    label: "+3 coach messages today",
    emoji: "💬",
    body: "Three extra messages on top of your daily limit.",
    lastsHours: null, // applies only to today; expiry handled via spin_date
  },
  {
    id: "dud",
    weight: 5,
    label: "No prize today",
    emoji: "🍃",
    body: "Better luck tomorrow.",
    lastsHours: null,
  },
];

export function pickOutcome(rng: () => number = Math.random): OutcomeMeta {
  const total = OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let pick = rng() * total;
  for (const o of OUTCOMES) {
    pick -= o.weight;
    if (pick <= 0) return o;
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

function pickOtherCompanion(
  currentId: string | null,
  rng: () => number = Math.random,
): CompanionId {
  const pool = COMPANIONS.filter((c) => c.id !== currentId);
  return pool[Math.floor(rng() * pool.length)].id;
}

export type ActiveRewards = {
  bonusMessages: number; // today only
  tricksUnlocked: boolean;
  sparkle: boolean;
  swappedCompanion: CompanionId | null;
};

export async function getActiveRewards(
  supabase: SupabaseClient,
  userId: string,
  todayDate: string,
): Promise<ActiveRewards> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("prize_spins")
    .select("outcome, payload, expires_at, spin_date")
    .eq("user_id", userId)
    .or(`expires_at.gt.${nowIso},spin_date.eq.${todayDate}`)
    .order("spin_date", { ascending: false });

  const rewards: ActiveRewards = {
    bonusMessages: 0,
    tricksUnlocked: false,
    sparkle: false,
    swappedCompanion: null,
  };

  for (const row of data ?? []) {
    const stillActive =
      (row.expires_at && row.expires_at > nowIso) ||
      (row.spin_date === todayDate &&
        row.outcome === "bonus_messages");
    if (!stillActive) continue;

    switch (row.outcome) {
      case "bonus_messages":
        rewards.bonusMessages += 3;
        break;
      case "tricks_unlock":
        rewards.tricksUnlocked = true;
        break;
      case "sparkle":
        rewards.sparkle = true;
        break;
      case "companion_swap": {
        const swapped = (row.payload as { companion?: string } | null)
          ?.companion;
        if (swapped) rewards.swappedCompanion = swapped as CompanionId;
        break;
      }
      default:
        break;
    }
  }
  return rewards;
}

// Internal helper used by the server action to choose + persist a spin. The
// caller is responsible for auth + checking that today hasn't been spun.
export async function applyOutcome(
  supabase: SupabaseClient,
  userId: string,
  todayDate: string,
  currentCompanionId: string | null,
): Promise<OutcomeMeta> {
  const outcome = pickOutcome();
  const payload: Record<string, unknown> = {};
  const expiresAt = outcome.lastsHours
    ? new Date(Date.now() + outcome.lastsHours * 60 * 60 * 1000).toISOString()
    : null;

  if (outcome.id === "companion_swap") {
    payload.companion = pickOtherCompanion(currentCompanionId);
  }

  // Side effects: milestone_star inserts a star with a special kind so the
  // user's regular milestone progression is unaffected.
  if (outcome.id === "milestone_star") {
    await supabase.from("stars").insert({
      user_id: userId,
      kind: `bonus_${todayDate}`,
      channel_id: null,
    });
  }

  await supabase.from("prize_spins").insert({
    user_id: userId,
    spin_date: todayDate,
    outcome: outcome.id,
    payload: Object.keys(payload).length > 0 ? payload : null,
    expires_at: expiresAt,
  });

  return outcome;
}
