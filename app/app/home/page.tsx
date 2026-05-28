import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeSavings,
  computeStreak,
  earnedMilestones,
  MILESTONES,
  milestoneKind,
} from "@/lib/streak";
import { SignOutButton } from "./sign-out-button";
import { RelapseButton, RestartButton } from "./relapse-button";
import { awardMilestoneStars } from "./actions";
import { ActiveSOSBanner, SOSButton } from "./sos-button";
import { getWithdrawalStage } from "@/lib/withdrawal";
import { computeInsights } from "@/lib/craving-insights";
import { getTriggerPlans, isInPeakWindow } from "@/lib/trigger-plans";
import { TimezoneCapture } from "./timezone-capture";
import { getCompletedSteps } from "@/lib/prep";
import { getLocalNow } from "@/lib/timezone";
import { PrepCard } from "./prep-card";
import { getTodaysMood } from "@/lib/mood";
import { MoodCard } from "./mood-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Core profile load — must succeed. Surface the error rather than looping.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "display_name, quit_date, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons, timezone",
    )
    .eq("id", user.id)
    .single();

  if (profileErr) {
    throw new Error(`Couldn't load profile: ${profileErr.message}`);
  }
  if (!profile?.quit_date) redirect("/app/onboarding");

  // Optional/newer columns — failures here just mean "migration not run yet".
  const { data: goalData } = await supabase
    .from("profiles")
    .select("savings_goal_name, savings_goal_amount")
    .eq("id", user.id)
    .single();
  const savingsGoalName = goalData?.savings_goal_name ?? null;
  const savingsGoalAmount = goalData?.savings_goal_amount ?? null;

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
  const savings = computeSavings({
    days,
    cigsPerDay: profile.baseline_cigs_per_day,
    costPerPack: profile.cost_per_pack,
    cigsPerPack: profile.cigs_per_pack,
  });

  // Fire-and-forget on every load — idempotent.
  if (streak.kind === "quit" && days > 0) {
    await awardMilestoneStars(days);
  }

  const { data: starsData } = await supabase
    .from("stars")
    .select("kind, awarded_at")
    .eq("user_id", user.id)
    .is("channel_id", null);

  const earnedKinds = new Set((starsData ?? []).map((s) => s.kind));
  const nextMilestone =
    MILESTONES.find((m) => !earnedKinds.has(milestoneKind(m))) ?? null;

  const { data: channelRows } = await supabase
    .from("channel_members")
    .select("channels!inner(id, name)")
    .eq("user_id", user.id);

  const channels = (channelRows ?? []).flatMap((row) => {
    const c = Array.isArray(row.channels) ? row.channels : [row.channels];
    return c.filter(Boolean) as { id: string; name: string }[];
  });

  // Active (unresolved) SOS by this user — show banner if any.
  const { data: activeSos } = await supabase
    .from("sos_signals")
    .select("note, created_at")
    .eq("user_id", user.id)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // This week digest: cheers received + peer milestones in the last 7 days.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const channelIds = channels.map((c) => c.id);

  const { count: cheersThisWeek } = await supabase
    .from("reactions")
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", user.id)
    .gte("created_at", sevenDaysAgo);

  // Quit-day prep: days until the user's chosen quit date in their tz.
  const tz = profile.timezone ?? null;
  const localToday = getLocalNow(tz)?.date ?? new Date().toISOString().slice(0, 10);
  const quitDateStr = profile.quit_date
    ? new Date(profile.quit_date).toISOString().slice(0, 10)
    : null;
  const daysUntilQuit =
    quitDateStr && quitDateStr > localToday
      ? Math.round(
          (new Date(quitDateStr).getTime() -
            new Date(localToday).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;
  const completedPrepIds = daysUntilQuit !== null
    ? [...(await getCompletedSteps(supabase, user.id))]
    : [];

  const todaysMood = await getTodaysMood(supabase, user.id, localToday);

  // Daily spin: has today been spun?
  const { data: todaySpinRow } = await supabase
    .from("prize_spins")
    .select("outcome")
    .eq("user_id", user.id)
    .eq("spin_date", localToday)
    .maybeSingle();
  const spinAvailable = !todaySpinRow;

  // Active if-then plan to surface if we're currently inside the peak window.
  const [{ data: cravingRows }, plans] = await Promise.all([
    supabase
      .from("cravings")
      .select("intensity, trigger, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    getTriggerPlans(supabase, user.id),
  ]);
  const peakInsights = computeInsights(cravingRows ?? [], {
    tz: profile.timezone ?? null,
  });
  const inPeak = isInPeakWindow(peakInsights.peakWindow);
  const peakTopTrigger = peakInsights.topTrigger?.name ?? null;
  const peakPlan =
    inPeak && peakTopTrigger
      ? plans.find((p) => p.trigger === peakTopTrigger) ?? null
      : null;

  let peerMilestonesThisWeek = 0;
  if (channelIds.length > 0) {
    const { data: peerIds } = await supabase
      .from("channel_members")
      .select("user_id")
      .in("channel_id", channelIds)
      .neq("user_id", user.id);
    const ids = [...new Set((peerIds ?? []).map((p) => p.user_id))];
    if (ids.length > 0) {
      const { count } = await supabase
        .from("stars")
        .select("id", { count: "exact", head: true })
        .in("user_id", ids)
        .is("channel_id", null)
        .gte("awarded_at", sevenDaysAgo);
      peerMilestonesThisWeek = count ?? 0;
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <TimezoneCapture needs={!profile.timezone} />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quit Buddy</h1>
          <p className="text-sm text-neutral-500">
            Hi, {profile.display_name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/settings"
            className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Settings
          </Link>
          <SignOutButton />
        </div>
      </header>

      {daysUntilQuit !== null && (
        <PrepCard
          daysUntil={daysUntilQuit}
          completedIds={completedPrepIds}
        />
      )}

      {streak.kind === "quit" ? (
        <>
          <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-white">
            <p className="text-sm opacity-80">Smoke-free for</p>
            <p className="mt-1 text-6xl font-bold tabular-nums">
              {days}
              <span className="ml-2 text-2xl font-normal opacity-80">
                {days === 1 ? "day" : "days"}
              </span>
            </p>
            {nextMilestone && (
              <p className="mt-4 text-sm opacity-80">
                {nextMilestone - days}{" "}
                {nextMilestone - days === 1 ? "day" : "days"} to your next star
                ({nextMilestone}-day milestone)
              </p>
            )}
          </section>

          {profile.reasons && (
            <p className="rounded-2xl bg-neutral-50 px-5 py-4 text-sm italic text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              &ldquo;{profile.reasons}&rdquo;
            </p>
          )}

          <SectionLabel>Today</SectionLabel>

          <MoodCard today={todaysMood} />

          <WithdrawalCard days={days} />

          {peakPlan && (
            <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                In your peak craving window
              </p>
              <p className="mt-2 text-sm">
                <span className="text-neutral-500">When </span>
                <span className="font-semibold">{peakPlan.trigger}</span>
                <span className="text-neutral-500">, you said you would: </span>
                <span className="font-medium">{peakPlan.plan}</span>
              </p>
            </section>
          )}


          <SectionLabel>Progress</SectionLabel>

          <section className="grid grid-cols-2 gap-3">
            <Stat
              label="Money saved"
              value={`$${savings.moneySaved.toFixed(2)}`}
            />
            <Stat
              label="Cigs avoided"
              value={savings.cigsAvoided.toLocaleString()}
            />
          </section>

          {savingsGoalAmount && Number(savingsGoalAmount) > 0 && (
            <SavingsGoalBar
              name={savingsGoalName ?? "Goal"}
              saved={savings.moneySaved}
              target={Number(savingsGoalAmount)}
            />
          )}

          <SectionLabel>Tools</SectionLabel>

          <section className="grid grid-cols-2 gap-3">
            <Tool
              href="/app/coach"
              icon="🤝"
              label="Coach"
              hint="Talk it out"
            />
            <Tool
              href="/app/breathe"
              icon="🌬"
              label="Breathe"
              hint="Calm a craving"
            />
            <Tool
              href="/app/game"
              icon="🎮"
              label="Distract"
              hint="Play through it"
            />
            <Tool
              href="/app/health"
              icon="📈"
              label="Health"
              hint="You're healing"
            />
            <Tool
              href="/app/cravings"
              icon="📓"
              label="Cravings"
              hint="Log + patterns"
            />
            <Tool
              href="/app/buddy"
              icon="🫂"
              label="Buddy"
              hint="One person, in your corner"
            />
            <Tool
              href="/app/meds"
              icon="💊"
              label="Meds"
              hint="Track NRT + doses"
            />
            <Tool
              href="/app/spin"
              icon="🎁"
              label={spinAvailable ? "Spin (new!)" : "Spin"}
              hint={spinAvailable ? "Daily prize ready" : "Already spun today"}
            />
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Stars earned
              </h2>
              {days > 0 && (
                <Link
                  href="/app/share"
                  className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Share streak →
                </Link>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {earnedMilestones(days).length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Your first star lands at day 1.
                </p>
              ) : (
                earnedMilestones(days).map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                  >
                    ⭐ {m}d
                  </span>
                ))
              )}
            </div>
          </section>

          {channels.length > 0 &&
            ((cheersThisWeek ?? 0) > 0 || peerMilestonesThisWeek > 0) && (
              <section className="rounded-2xl bg-neutral-50 px-5 py-4 dark:bg-neutral-900">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  This week
                </h2>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {(cheersThisWeek ?? 0) > 0 && (
                    <>
                      <strong>{cheersThisWeek}</strong>{" "}
                      {cheersThisWeek === 1 ? "cheer" : "cheers"} from
                      channel-mates
                    </>
                  )}
                  {(cheersThisWeek ?? 0) > 0 &&
                    peerMilestonesThisWeek > 0 && <> · </>}
                  {peerMilestonesThisWeek > 0 && (
                    <>
                      <strong>{peerMilestonesThisWeek}</strong> milestone
                      {peerMilestonesThisWeek !== 1 ? "s" : ""} by your mates
                    </>
                  )}
                </p>
              </section>
            )}

          <SectionLabel>If you need it</SectionLabel>

          {activeSos ? (
            <ActiveSOSBanner
              note={activeSos.note}
              sentAt={new Date(activeSos.created_at)}
            />
          ) : (
            <div className="flex justify-center">
              <SOSButton
                hasChannels={channels.length > 0}
                reasons={profile.reasons ?? null}
              />
            </div>
          )}

          <div className="mt-2 flex justify-center">
            <RelapseButton canRelapse />
          </div>
        </>
      ) : (
        <section className="flex flex-col gap-4 rounded-3xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p className="text-5xl">🌱</p>
          <h2 className="text-xl font-semibold">Day 0</h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            It&apos;s okay. Every quit starts here. Ready to begin again?
          </p>
          <div className="mt-2 flex justify-center">
            <RestartButton />
          </div>
        </section>
      )}

      <ChannelsSection channels={channels} />
    </main>
  );
}

function ChannelsSection({
  channels,
}: {
  channels: { id: string; name: string }[];
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Your channels
      </h2>

      {channels.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          Quit smoking with people who&apos;ll keep you accountable.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/channels/${c.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-neutral-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href="/app/channels/new"
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          + Create
        </Link>
        <Link
          href="/app/channels/join"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-center text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Join by code
        </Link>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="-mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SavingsGoalBar({
  name,
  saved,
  target,
}: {
  name: string;
  saved: number;
  target: number;
}) {
  const pct = Math.max(0, Math.min(100, (saved / target) * 100));
  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Goal: {name}
        </h2>
        <p className="text-sm tabular-nums">
          ${saved.toFixed(0)} <span className="text-neutral-500">/ ${target}</span>
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {pct >= 100
          ? "🎉 You hit your goal!"
          : `${pct.toFixed(0)}% there`}
      </p>
    </section>
  );
}

function WithdrawalCard({ days }: { days: number }) {
  const { current, next, daysUntilNext } = getWithdrawalStage(days);
  return (
    <Link
      href="/app/withdrawal"
      className="flex flex-col gap-1 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 transition hover:border-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Where you are
      </p>
      <p className="text-sm font-semibold">{current.headline}</p>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {next && daysUntilNext != null && daysUntilNext > 0
          ? `${daysUntilNext} ${daysUntilNext === 1 ? "day" : "days"} until: ${next.headline.replace(/\.$/, "")}`
          : current.reassurance}
      </p>
    </Link>
  );
}

function Tool({
  href,
  icon,
  label,
  hint,
}: {
  href: Route;
  icon: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-neutral-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
    >
      <p className="text-2xl">{icon}</p>
      <p className="mt-2 font-semibold">{label}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </Link>
  );
}
