import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import { ShareButton } from "./share-button";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS hides channels the user isn't a member of, so .single() will fail.
  const { data: channel } = await supabase
    .from("channels")
    .select("id, name, invite_code, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!channel) notFound();

  // Members + their profiles.
  const { data: members } = await supabase
    .from("channel_members")
    .select("user_id, role, profiles!inner(display_name)")
    .eq("channel_id", id);

  const memberIds = (members ?? []).map((m) => m.user_id);

  // Latest streak event per member (ordered desc; we take the first per user).
  const { data: events } = await supabase
    .from("streak_events")
    .select("user_id, type, occurred_at")
    .in("user_id", memberIds)
    .order("occurred_at", { ascending: false });

  const latestByUser = new Map<string, { type: "quit" | "relapse"; occurred_at: string }>();
  for (const e of events ?? []) {
    if (!latestByUser.has(e.user_id)) {
      latestByUser.set(e.user_id, {
        type: e.type as "quit" | "relapse",
        occurred_at: e.occurred_at,
      });
    }
  }

  const rows = (members ?? [])
    .map((m) => {
      const streak = computeStreak(latestByUser.get(m.user_id) ?? null);
      const days = streak.kind === "quit" ? streak.days : 0;
      // PostgREST nested select returns an array even with !inner — handle both.
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        userId: m.user_id,
        displayName:
          (profile as { display_name?: string } | null)?.display_name ?? "—",
        role: m.role as "owner" | "member",
        days,
        relapsed: streak.kind === "relapse",
      };
    })
    .sort((a, b) => b.days - a.days);

  const myRank = rows.findIndex((r) => r.userId === user.id) + 1;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{channel.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {rows.length} {rows.length === 1 ? "member" : "members"} · Invite code:{" "}
          <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono dark:bg-neutral-800">
            {channel.invite_code}
          </span>
        </p>
        {myRank > 0 && (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            You&apos;re ranked #{myRank} of {rows.length}
          </p>
        )}
        <div className="mt-4">
          <ShareButton
            channelName={channel.name}
            inviteCode={channel.invite_code}
          />
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Leaderboard
        </h2>
        <ol>
          {rows.map((row, idx) => {
            const isMe = row.userId === user.id;
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
            return (
              <li
                key={row.userId}
                className={`flex items-center justify-between border-b border-neutral-200 px-5 py-4 last:border-b-0 dark:border-neutral-800 ${
                  isMe ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-sm font-medium tabular-nums text-neutral-500">
                    {medal ?? `#${idx + 1}`}
                  </span>
                  <div>
                    <p className="font-medium">
                      {row.displayName}
                      {isMe && (
                        <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                          you
                        </span>
                      )}
                      {row.role === "owner" && (
                        <span className="ml-2 text-xs text-neutral-500">
                          · owner
                        </span>
                      )}
                    </p>
                    {row.relapsed && (
                      <p className="text-xs text-neutral-500">restarting…</p>
                    )}
                  </div>
                </div>
                <p className="text-lg font-semibold tabular-nums">
                  {row.days}
                  <span className="ml-1 text-sm font-normal text-neutral-500">
                    {row.days === 1 ? "day" : "days"}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
