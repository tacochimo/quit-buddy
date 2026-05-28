// Server-side analytics. Fire-and-forget — never let a tracking failure
// block a real action. No-ops when env vars are absent so dev/local runs
// stay quiet.

import { PostHog } from "posthog-node";

export type AnalyticsEvent =
  | "app_opened"
  | "craving_logged"
  | "coach_message_sent"
  | "slip_recorded"
  | "med_dose_logged"
  | "plan_saved"
  | "plan_used"
  | "spin_completed"
  | "game_played"
  | "companion_changed"
  | "upgrade_started"
  | "upgrade_completed"
  | "notification_sent"
  | "mood_logged";

let client: PostHog | null = null;
let initFailed = false;

function getClient(): PostHog | null {
  if (initFailed) return null;
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  try {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1, // serverless: flush each event since the process may die
      flushInterval: 0,
    });
    return client;
  } catch (e) {
    console.error("[analytics] PostHog init failed:", e);
    initFailed = true;
    return null;
  }
}

export function track(
  event: AnalyticsEvent,
  userId: string | null,
  properties?: Record<string, unknown>,
): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: userId ?? "anonymous",
      event,
      properties,
    });
  } catch (e) {
    console.error(`[analytics] capture failed for ${event}:`, e);
  }
}

// Call in shutdown hooks if you ever add one. In serverless, flushAt:1 already
// flushes per event, so this is mainly a no-op safety net.
export async function flushAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // ignore
  }
}
