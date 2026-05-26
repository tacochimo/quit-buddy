import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/activity";
import { LogCravingForm } from "./log-form";

export const dynamic = "force-dynamic";

export default async function CravingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cravingsData } = await supabase
    .from("cravings")
    .select("id, intensity, trigger, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const cravings = cravingsData ?? [];

  // Cheap pattern hint: most common trigger in the last 30 days.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = cravings.filter(
    (c) => new Date(c.created_at).getTime() >= cutoff,
  );
  const triggerCounts = new Map<string, number>();
  for (const c of recent) {
    if (c.trigger)
      triggerCounts.set(c.trigger, (triggerCounts.get(c.trigger) ?? 0) + 1);
  }
  const topTrigger = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

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

      <LogCravingForm />

      {recent.length >= 3 && topTrigger && (
        <p className="rounded-2xl bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          📊 In the last 30 days, your most common trigger is{" "}
          <strong>{topTrigger[0]}</strong> ({topTrigger[1]} times).
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Recent
        </h2>
        {cravings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            No entries yet. Log one above next time a craving hits.
          </p>
        ) : (
          <ul>
            {cravings.map((c) => (
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
