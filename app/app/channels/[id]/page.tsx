import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
import { buildActivity, describeActivity, timeAgo } from "@/lib/activity";
import { ShareButton } from "./share-button";
import { CheerButton } from "./cheer-button";
import { RealtimeRefresher } from "./realtime-refresher";
import { ManageButton } from "./manage-button";
import { CopyCode } from "./copy-code";

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

  const { data: channel } = await supabase
    .from("channels")
    .select("id, name, invite_code, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!channel) notFound();

  const { data: membersRaw } = await supabase
    .from("channel_members")
    .select("user_id, role, joined_at, profiles!inner(display_name)")
    .eq("channel_id", id);

  const members = (membersRaw ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      role: m.role as "owner" | "member",
      joined_at: m.joined_at,
      display_name:
        (p as { display_name?: string } | null)?.display_name ?? "—",
    };
  });

  const memberIds = members.map((m) => m.user_id);

  // All streak events for these members (newest first).
  const { data: eventsData } = await supabase
    .from("streak_events")
    .select("id, user_id, type, occurred_at")
    .in("user_id", memberIds)
    .order("occurred_at", { ascending: false });
  const events = eventsData ?? [];

  // Personal milestone stars for these members.
  const { data: starsData } = await supabase
    .from("stars")
    .select("id, user_id, kind, awarded_at")
    .in("user_id", memberIds)
    .is("channel_id", null);
  const stars = starsData ?? [];

  // SOS signals in this channel.
  const { data: sosData } = await supabase
    .from("sos_signals")
    .select("id, user_id, note, created_at, resolved_at")
    .eq("channel_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const sos = sosData ?? [];

  // Cheer counts received per member in this channel.
  const { data: reactionsData } = await supabase
    .from("reactions")
    .select("to_user_id")
    .eq("channel_id", id);
  const cheersByUser = new Map<string, number>();
  for (const r of reactionsData ?? []) {
    cheersByUser.set(r.to_user_id, (cheersByUser.get(r.to_user_id) ?? 0) + 1);
  }

  // Latest streak event per user → current streak.
  const latestByUser = new Map<
    string,
    { type: "quit" | "relapse"; occurred_at: string }
  >();
  for (const e of events) {
    if (!latestByUser.has(e.user_id)) {
      latestByUser.set(e.user_id, {
        type: e.type as "quit" | "relapse",
        occurred_at: e.occurred_at,
      });
    }
  }

  const rows = members
    .map((m) => {
      const streak = computeStreak(latestByUser.get(m.user_id) ?? null);
      const days = streak.kind === "quit" ? streak.days : 0;
      return {
        userId: m.user_id,
        displayName: m.display_name,
        role: m.role,
        days,
        relapsed: streak.kind === "relapse",
        cheers: cheersByUser.get(m.user_id) ?? 0,
      };
    })
    .sort((a, b) => b.days - a.days);

  const myRank = rows.findIndex((r) => r.userId === user.id) + 1;

  const activity = buildActivity({ members, events, stars, sos });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <RealtimeRefresher channelId={channel.id} />
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{channel.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
          <span>
            {rows.length} {rows.length === 1 ? "member" : "members"}
          </span>
          <span>·</span>
          <span>Invite code:</span>
          <CopyCode code={channel.invite_code} />
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
            const medal =
              idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
            return (
              <li
                key={row.userId}
                className={`flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 last:border-b-0 dark:border-neutral-800 ${
                  isMe ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-sm font-medium tabular-nums text-neutral-500">
                    {medal ?? `#${idx + 1}`}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
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
                <div className="flex shrink-0 items-center gap-3">
                  {!isMe ? (
                    <CheerButton
                      channelId={channel.id}
                      toUserId={row.userId}
                      count={row.cheers}
                    />
                  ) : row.cheers > 0 ? (
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-800">
                      👏 {row.cheers}
                    </span>
                  ) : null}
                  <p className="text-lg font-semibold tabular-nums">
                    {row.days}
                    <span className="ml-1 text-sm font-normal text-neutral-500">
                      {row.days === 1 ? "day" : "days"}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Activity
        </h2>
        {activity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            Nothing yet. Hit your first day or invite a friend.
          </p>
        ) : (
          <ul>
            {activity.map((item) => {
              const isSos = item.kind === "sos";
              return (
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-3 text-sm last:border-b-0 dark:border-neutral-800 ${
                    isSos
                      ? "bg-amber-50 font-medium dark:bg-amber-950/30"
                      : ""
                  }`}
                >
                  <span className="min-w-0">{describeActivity(item)}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {timeAgo(item.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-2 flex justify-center">
        <ManageButton
          channelId={channel.id}
          isOwner={channel.created_by === user.id}
        />
      </div>
    </main>
  );
}
