import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import {
  WITHDRAWAL_STAGES,
  getWithdrawalStage,
  type WithdrawalStage,
} from "@/lib/withdrawal";

export const dynamic = "force-dynamic";

export default async function WithdrawalPage() {
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
  const days = streak.kind === "quit" ? streak.days : 0;
  const { current, next, daysUntilNext } = getWithdrawalStage(days);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Withdrawal timeline</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {streak.kind === "quit"
            ? `Day ${days} of your current quit. Here's where you are and what's coming.`
            : "When you start a new quit, this page will show you where you are."}
        </p>
      </header>

      {streak.kind === "quit" && (
        <section className="rounded-2xl border border-emerald-400 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            You are here
          </p>
          <p className="mt-2 text-lg font-semibold">{current.headline}</p>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {current.summary}
          </p>
          <p className="mt-3 text-sm italic text-emerald-800 dark:text-emerald-300">
            {current.reassurance}
          </p>
          {next && daysUntilNext != null && (
            <p className="mt-3 text-xs text-neutral-500">
              {daysUntilNext === 0
                ? `Crossing into "${next.headline.replace(/\.$/, "")}" today.`
                : `${daysUntilNext} ${daysUntilNext === 1 ? "day" : "days"} until the next stage.`}
            </p>
          )}
        </section>
      )}

      <ol className="flex flex-col gap-4">
        {WITHDRAWAL_STAGES.map((s) => (
          <StageCard
            key={s.id}
            stage={s}
            state={
              streak.kind !== "quit"
                ? "future"
                : days >= (s.endDay ?? Infinity)
                  ? "past"
                  : s.id === current.id
                    ? "current"
                    : "future"
            }
          />
        ))}
      </ol>

      <p className="text-center text-xs text-neutral-500">
        See also the{" "}
        <Link
          href="/app/health"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          physical recovery timeline
        </Link>
        .
      </p>
    </main>
  );
}

function StageCard({
  stage,
  state,
}: {
  stage: WithdrawalStage;
  state: "past" | "current" | "future";
}) {
  const range =
    stage.endDay === null
      ? `Day ${stage.startDay}+`
      : stage.startDay === 0
        ? `First ${stage.endDay * 24}h`
        : `Day ${stage.startDay}–${stage.endDay}`;

  const border =
    state === "current"
      ? "border-emerald-400 dark:border-emerald-700"
      : state === "past"
        ? "border-neutral-300 dark:border-neutral-700"
        : "border-neutral-200 dark:border-neutral-800";

  const label =
    state === "current"
      ? "Now"
      : state === "past"
        ? "Past"
        : "Ahead";

  const labelColor =
    state === "current"
      ? "text-emerald-700 dark:text-emerald-400"
      : state === "past"
        ? "text-neutral-500"
        : "text-neutral-400";

  return (
    <li
      className={`rounded-2xl border ${border} p-5 ${
        state === "past" ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-neutral-500">{range}</p>
        <p className={`text-xs font-semibold uppercase ${labelColor}`}>
          {label}
        </p>
      </div>
      <p className="mt-1 font-semibold">{stage.headline}</p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {stage.summary}
      </p>
      <ul className="mt-3 grid gap-1 text-sm text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
        {stage.symptoms.map((sym) => (
          <li key={sym} className="flex gap-2">
            <span aria-hidden className="text-neutral-400">
              ·
            </span>
            <span>{sym}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
