import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/activity";
import { AddRegimenForm, RegimenActions } from "./forms";

export const dynamic = "force-dynamic";

type Regimen = {
  id: string;
  name: string;
  kind: string;
  dose_mg: number | null;
  schedule: "daily" | "twice-daily" | "prn";
  started_on: string;
  ended_on: string | null;
  notes: string | null;
};

type Event = {
  id: string;
  regimen_id: string | null;
  occurred_at: string;
  kind: "dose" | "skipped" | "side_effect";
  count: number | null;
  side_effect: string | null;
  notes: string | null;
};

export default async function MedsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [regimensRes, eventsRes] = await Promise.all([
    supabase
      .from("med_regimens")
      .select(
        "id, name, kind, dose_mg, schedule, started_on, ended_on, notes",
      )
      .eq("user_id", user.id)
      .order("started_on", { ascending: false }),
    supabase
      .from("med_events")
      .select("id, regimen_id, occurred_at, kind, count, side_effect, notes")
      .eq("user_id", user.id)
      .gte("occurred_at", sevenDaysAgo)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  const regimens = (regimensRes.data ?? []) as Regimen[];
  const events = (eventsRes.data ?? []) as Event[];
  const active = regimens.filter((r) => !r.ended_on);
  const past = regimens.filter((r) => r.ended_on);
  const nameOf = new Map(regimens.map((r) => [r.id, r.name]));

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Medications &amp; NRT</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Track patches, gum, varenicline — whatever you&apos;re using to quit.
          Your doctor PDF will include this.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Currently on
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing logged yet. Add a regimen below.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-neutral-500">
                    {scheduleLabel(r.schedule)} · started{" "}
                    {new Date(r.started_on).toLocaleDateString()}
                    {r.dose_mg != null && <> · {r.dose_mg} mg</>}
                  </p>
                  {r.notes && (
                    <p className="mt-1 text-xs italic text-neutral-500">
                      {r.notes}
                    </p>
                  )}
                </div>
                <RegimenActions regimenId={r.id} schedule={r.schedule} />
              </li>
            ))}
          </ul>
        )}
        <AddRegimenForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Last 7 days
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-neutral-500">No events yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0 dark:border-neutral-800"
              >
                <div>
                  <p>
                    <EventBadge kind={e.kind} />
                    {e.kind === "dose" && e.count && e.count > 1 && (
                      <span className="ml-2 text-neutral-500">
                        ×{e.count}
                      </span>
                    )}
                    {e.side_effect && (
                      <span className="ml-2">{e.side_effect}</span>
                    )}
                    {e.regimen_id && nameOf.get(e.regimen_id) && (
                      <span className="ml-2 text-neutral-500">
                        · {nameOf.get(e.regimen_id)}
                      </span>
                    )}
                  </p>
                  {e.notes && (
                    <p className="mt-0.5 text-xs italic text-neutral-500">
                      {e.notes}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-500">
                  {timeAgo(new Date(e.occurred_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Past regimens
          </h2>
          <ul className="text-sm text-neutral-600 dark:text-neutral-400">
            {past.map((r) => (
              <li key={r.id} className="border-b border-neutral-200 py-2 last:border-b-0 dark:border-neutral-800">
                {r.name} · {new Date(r.started_on).toLocaleDateString()} →{" "}
                {r.ended_on && new Date(r.ended_on).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function scheduleLabel(s: string) {
  if (s === "daily") return "Daily";
  if (s === "twice-daily") return "Twice daily";
  return "As needed";
}

function EventBadge({ kind }: { kind: "dose" | "skipped" | "side_effect" }) {
  if (kind === "dose") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        Dose
      </span>
    );
  }
  if (kind === "skipped") {
    return (
      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        Skipped
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      Side effect
    </span>
  );
}
