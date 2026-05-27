import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/activity";
import { LogCravingForm } from "./log-form";
import { computeInsights, fmtHour } from "@/lib/craving-insights";

export const dynamic = "force-dynamic";

export default async function CravingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pull a wider window for pattern detection; the recent list still shows
  // the most recent 50 below.
  const { data: cravingsData } = await supabase
    .from("cravings")
    .select("id, intensity, trigger, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const cravings = cravingsData ?? [];

  const insights = computeInsights(cravings);
  const recent = cravings.slice(0, 50);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Craving journal</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Logging what triggers you helps you see the pattern — and break it.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Right now
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/app/breathe"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            🌬 Breathe
          </Link>
          <Link
            href="/app/game"
            className="flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            🎮 Distract
          </Link>
        </div>
      </section>

      <LogCravingForm />

      {insights.total >= 4 && <InsightsPanel insights={insights} />}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Recent
        </h2>
        {recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            No entries yet. Log one above next time a craving hits.
          </p>
        ) : (
          <ul>
            {recent.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 border-b border-neutral-200 px-5 py-3 text-sm last:border-b-0 dark:border-neutral-800"
              >
                <div className="flex items-center justify-between">
                  <span>
                    <IntensityDots level={c.intensity} />
                    {c.trigger && (
                      <span className="ml-3 text-neutral-600 dark:text-neutral-400">
                        · {c.trigger}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {timeAgo(new Date(c.created_at))}
                  </span>
                </div>
                {c.note && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {c.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function InsightsPanel({
  insights,
}: {
  insights: ReturnType<typeof computeInsights>;
}) {
  const cards: Array<{ icon: string; title: string; body: React.ReactNode }> = [];

  if (insights.peakWindow) {
    const { startHour, endHour, count } = insights.peakWindow;
    cards.push({
      icon: "🕒",
      title: "Peak window",
      body: (
        <>
          Most cravings hit between{" "}
          <strong>
            {fmtHour(startHour)}–{fmtHour(endHour)}
          </strong>{" "}
          ({count} of {insights.total}). Plan a 5-minute distraction for that
          window — walk, water, breath.
        </>
      ),
    });
  }

  if (insights.topTrigger) {
    const { name, count, avgIntensity } = insights.topTrigger;
    cards.push({
      icon: "🎯",
      title: "Top trigger",
      body: (
        <>
          <strong>{name}</strong> — {count} cravings, average intensity{" "}
          <strong>{avgIntensity}/5</strong>. When you spot it coming, name it
          first.
        </>
      ),
    });
  }

  if (insights.intensityTrend) {
    const { recent, prior, direction, deltaPct } = insights.intensityTrend;
    const sign = deltaPct >= 0 ? "+" : "";
    cards.push({
      icon: direction === "down" ? "📉" : direction === "up" ? "📈" : "➡️",
      title: "Intensity trend",
      body: (
        <>
          Two-week average: <strong>{recent}/5</strong> (was {prior}/5,{" "}
          {sign}
          {deltaPct}%).{" "}
          {direction === "down"
            ? "Cravings are getting milder. Keep going."
            : direction === "up"
              ? "Worth talking to your coach about what shifted."
              : "Steady — the work is mostly riding them out."}
        </>
      ),
    });
  }

  if (insights.frequencyTrend) {
    const { recent, prior, direction } = insights.frequencyTrend;
    cards.push({
      icon: "📊",
      title: "This week",
      body: (
        <>
          <strong>{recent}</strong> cravings logged (was {prior} last week).{" "}
          {direction === "down"
            ? "Frequency is dropping."
            : direction === "up"
              ? "More than last week — note what changed."
              : "About the same pace."}
        </>
      ),
    });
  }

  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Patterns
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <span aria-hidden>{c.icon}</span>
              {c.title}
            </p>
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IntensityDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= level
              ? "bg-amber-500"
              : "bg-neutral-200 dark:bg-neutral-700"
          }`}
        />
      ))}
    </span>
  );
}
