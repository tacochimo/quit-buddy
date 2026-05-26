import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import { HEALTH_MILESTONES } from "@/lib/health-timeline";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: latestEvent } = await supabase
    .from("streak_events")
    .select("type, occurred_at")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const streak = computeStreak(
    latestEvent as { type: "quit" | "relapse"; occurred_at: string } | null,
  );

  // Use fractional days so 20-minute / 12-hour milestones light up early.
  const fractionalDays =
    streak.kind === "quit"
      ? (Date.now() - streak.quitDate.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Your body is healing</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Evidence-based recovery milestones from the moment you quit.
        </p>
      </header>

      <ol className="relative ml-3 border-l-2 border-neutral-200 dark:border-neutral-800">
        {HEALTH_MILESTONES.map((m) => {
          const reached = fractionalDays >= m.days;
          const remaining = Math.max(0, m.days - fractionalDays);
          return (
            <li key={m.label} className="mb-6 ml-6 last:mb-0">
              <span
                className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  reached
                    ? "bg-emerald-600 text-white"
                    : "border-2 border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
                }`}
                aria-hidden
              >
                {reached ? "✓" : ""}
              </span>
              <p
                className={`text-sm font-semibold ${
                  reached
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                {m.label}
                {!reached && remaining < 1 && (
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    ({Math.ceil(remaining * 24 * 60)} min to go)
                  </span>
                )}
                {!reached && remaining >= 1 && (
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    ({Math.ceil(remaining)} days to go)
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {m.summary}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="text-center text-xs text-neutral-500">
        Source: CDC / Surgeon General quit-smoking timeline.
      </p>
    </main>
  );
}
