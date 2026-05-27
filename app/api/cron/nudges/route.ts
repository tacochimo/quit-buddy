import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNudges } from "@/lib/nudge-runner";
import { runMedReminders } from "@/lib/med-reminders";

// Vercel sets a CRON_SECRET when cron jobs are configured. We require it in
// prod; locally (no secret) the route is callable for testing.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse("unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();
  const [nudges, medReminders] = await Promise.all([
    runNudges(admin),
    runMedReminders(admin),
  ]);
  return NextResponse.json({ nudges, medReminders });
}
