import { createAdminClient } from "./supabase/admin";
import { sendPushToUser } from "./push";
import { getLocalNow, parseHm } from "./timezone";

const FIRE_WINDOW_MIN = 7; // ± minutes around the scheduled time

export async function runMedReminders(
  admin: ReturnType<typeof createAdminClient>,
) {
  // Pull all active regimens with reminders enabled. Then per-user we need
  // the timezone — fetch in a separate batched call.
  const { data: regimens } = await admin
    .from("med_regimens")
    .select("id, user_id, name, schedule, reminder_times")
    .eq("reminder_enabled", true)
    .is("ended_on", null);

  const rows = regimens ?? [];
  if (rows.length === 0) {
    return { checked: 0, fired: 0, skipped: 0 };
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds);
  const tzByUser = new Map(
    (profileRows ?? []).map((p) => [p.id, p.timezone as string | null]),
  );

  const stats = { checked: rows.length, fired: 0, skipped: 0 };

  for (const r of rows) {
    const tz = tzByUser.get(r.user_id) ?? null;
    const localNow = getLocalNow(tz);
    if (!localNow) {
      stats.skipped += 1;
      continue;
    }
    const nowMin = localNow.hour * 60 + localNow.minute;

    const matchingTimes: string[] = [];
    for (const hm of r.reminder_times ?? []) {
      const t = parseHm(hm);
      if (t < 0) continue;
      if (Math.abs(t - nowMin) <= FIRE_WINDOW_MIN) {
        matchingTimes.push(hm);
      }
    }
    if (matchingTimes.length === 0) {
      stats.skipped += 1;
      continue;
    }

    for (const hm of matchingTimes) {
      // Atomic dedup via PK (regimen_id, sent_for_date, sent_for_time).
      const { error: dedupErr } = await admin
        .from("med_reminders_sent")
        .insert({
          regimen_id: r.id,
          sent_for_date: localNow.date,
          sent_for_time: hm,
        });
      if (dedupErr) {
        // Unique violation → already fired today. Anything else: log + skip.
        if (!/duplicate|unique/i.test(dedupErr.message)) {
          console.error("[med-reminders] dedup insert:", dedupErr);
        }
        continue;
      }
      try {
        await sendPushToUser(r.user_id, {
          title: `💊 Time for your ${r.name}`,
          body: `Tap to log it. Scheduled for ${hm}.`,
          url: "/app/meds",
          tag: `med-${r.id}`,
        });
        stats.fired += 1;
      } catch (e) {
        console.error(`[med-reminders] push failed for ${r.user_id}:`, e);
      }
    }
  }

  return stats;
}
