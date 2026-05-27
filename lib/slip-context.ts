import type { SupabaseClient } from "@supabase/supabase-js";

export type RecentSlip = {
  kind: "slip" | "relapse";
  occurredAt: string;
  hoursAgo: number;
  count: number | null;
  trigger: string | null;
  intensity: number | null;
  whatWasHappening: string | null;
  whatIdDoDifferently: string | null;
};

const RECENT_WINDOW_HOURS = 24;

// Returns the most recent slip from the last 24h, so the coach can open with
// awareness of it. Null when there's nothing recent.
export async function getRecentSlipContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecentSlip | null> {
  const since = new Date(
    Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data } = await supabase
    .from("slips")
    .select(
      "kind, occurred_at, count, trigger, intensity, what_was_happening, what_id_do_differently",
    )
    .eq("user_id", userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const occurred = new Date(data.occurred_at);
  const hoursAgo = Math.max(
    0,
    Math.round((Date.now() - occurred.getTime()) / (60 * 60 * 1000)),
  );

  return {
    kind: data.kind as "slip" | "relapse",
    occurredAt: data.occurred_at,
    hoursAgo,
    count: data.count,
    trigger: data.trigger,
    intensity: data.intensity,
    whatWasHappening: data.what_was_happening,
    whatIdDoDifferently: data.what_id_do_differently,
  };
}

// One-line summary suitable for inlining into the coach system prompt.
export function slipContextLines(slip: RecentSlip): string[] {
  const lines: string[] = [];
  const when =
    slip.hoursAgo === 0
      ? "in the last hour"
      : `${slip.hoursAgo}h ago`;

  if (slip.kind === "slip") {
    const cig =
      slip.count != null
        ? `${slip.count} ${slip.count === 1 ? "cigarette" : "cigarettes"}`
        : "one slip";
    lines.push(
      `RECENT SLIP (${when}): they had ${cig}. Their streak still counts — do NOT congratulate, do NOT reset, do NOT call it a failure.`,
    );
  } else {
    lines.push(
      `RECENT RELAPSE (${when}): they've reset their streak. Lead with no-shame, then one small next step.`,
    );
  }

  if (slip.trigger || slip.intensity != null) {
    const bits: string[] = [];
    if (slip.trigger) bits.push(`trigger: ${slip.trigger}`);
    if (slip.intensity != null) bits.push(`intensity ${slip.intensity}/5`);
    lines.push(`Context — ${bits.join(", ")}.`);
  }
  if (slip.whatWasHappening) {
    lines.push(`What was happening: "${slip.whatWasHappening}"`);
  }
  if (slip.whatIdDoDifferently) {
    lines.push(
      `Their own plan for next time: "${slip.whatIdDoDifferently}" — reinforce this rather than inventing your own.`,
    );
  }
  lines.push(
    "Open the conversation acknowledging this without listing it back. One focused next thing.",
  );
  return lines;
}
