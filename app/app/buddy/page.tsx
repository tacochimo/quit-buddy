import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import { InviteCard, AcceptForm, RemoveButton, CancelButton } from "./forms";

export const dynamic = "force-dynamic";

export default async function BuddyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Single row lookup: any non-removed edge involving the user.
  const { data: link } = await supabase
    .from("buddy_links")
    .select("id, inviter_id, invitee_id, status, invite_code, accepted_at")
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let buddyProfile: {
    display_name: string;
    streakDays: number;
    isRelapsed: boolean;
  } | null = null;

  if (link?.status === "accepted") {
    const buddyId =
      link.inviter_id === user.id ? link.invitee_id : link.inviter_id;
    if (buddyId) {
      const [{ data: prof }, { data: latest }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", buddyId)
          .single(),
        supabase
          .from("streak_events")
          .select("type, occurred_at")
          .eq("user_id", buddyId)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const streak = computeStreak(
        latest as { type: "quit" | "relapse"; occurred_at: string } | null,
      );
      buddyProfile = {
        display_name: prof?.display_name ?? "Your buddy",
        streakDays: streak.kind === "quit" ? streak.days : 0,
        isRelapsed: streak.kind === "relapse",
      };
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Buddy</h1>
        <p className="mt-2 text-sm text-neutral-500">
          One person who has your back. They get a heads-up when you have a
          strong craving, and a louder ping if you slip — so you&apos;re not
          alone in the hardest moment.
        </p>
      </header>

      {buddyProfile ? (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Your buddy
          </p>
          <p className="mt-2 text-xl font-bold">
            {buddyProfile.display_name}
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
            {buddyProfile.isRelapsed
              ? "Restarting their quit — send them a kind word."
              : buddyProfile.streakDays === 0
                ? "Day 0 of their quit."
                : `${buddyProfile.streakDays} day${buddyProfile.streakDays === 1 ? "" : "s"} smoke-free.`}
          </p>
          <div className="mt-4">
            <RemoveButton />
          </div>
        </section>
      ) : link?.status === "pending" ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Waiting for them to join
          </p>
          <p className="mt-2 text-sm">Share this code with one person:</p>
          <p className="mt-3 select-all rounded-lg bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
            {link.invite_code}
          </p>
          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
            They open Lastember → Buddy → paste the code.
          </p>
          <div className="mt-4">
            <CancelButton />
          </div>
        </section>
      ) : (
        <>
          <InviteCard />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              or
            </span>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <AcceptForm />
        </>
      )}

      <section className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        <p className="font-semibold text-neutral-700 dark:text-neutral-300">
          How it works
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            You can have <strong>one</strong> buddy at a time — that&apos;s
            the point.
          </li>
          <li>
            When you log a craving of intensity 3+, your buddy gets a quiet
            push. Stronger cravings get a more direct one.
          </li>
          <li>If you log a relapse, they&apos;re pinged louder.</li>
          <li>Either of you can end the buddy at any time.</li>
        </ul>
      </section>
    </main>
  );
}
