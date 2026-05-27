import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  // Auth + admin gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email ?? null)) notFound();

  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Totals.
  const [totalUsersRes, monthRes, activeRes, recentChatRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true }),
    admin
      .from("ai_usage")
      .select("user_id, source, total_tokens, cost_usd, created_at")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("chat_messages")
      .select("user_id")
      .eq("role", "user")
      .gte("created_at", sevenDaysAgo.toISOString()),
    admin
      .from("ai_usage")
      .select("user_id, source, total_tokens, cost_usd, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const monthRows = monthRes.data ?? [];
  const totalCost = monthRows.reduce(
    (sum, r) => sum + Number(r.cost_usd ?? 0),
    0,
  );
  const totalTokens = monthRows.reduce(
    (sum, r) => sum + (r.total_tokens ?? 0),
    0,
  );
  const totalCalls = monthRows.length;

  const activeUserIds = new Set((activeRes.data ?? []).map((r) => r.user_id));

  // Top spenders (last 30 days).
  const last30 = await admin
    .from("ai_usage")
    .select("user_id, cost_usd, total_tokens")
    .gte("created_at", thirtyDaysAgo.toISOString());
  const byUser = new Map<
    string,
    { calls: number; tokens: number; cost: number }
  >();
  for (const r of last30.data ?? []) {
    const cur = byUser.get(r.user_id) ?? { calls: 0, tokens: 0, cost: 0 };
    cur.calls += 1;
    cur.tokens += r.total_tokens ?? 0;
    cur.cost += Number(r.cost_usd ?? 0);
    byUser.set(r.user_id, cur);
  }
  const topUserIds = [...byUser.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10);

  // Resolve names.
  const { data: nameRows } = await admin
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      topUserIds.map(([id]) => id),
    );
  const nameOf = new Map((nameRows ?? []).map((p) => [p.id, p.display_name]));

  const topSpenders = topUserIds.map(([id, stats]) => ({
    id,
    name: nameOf.get(id) ?? id.slice(0, 8),
    ...stats,
  }));

  // Daily cost trend (last 14 days).
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const dayBuckets = new Map<string, { calls: number; cost: number }>();
  for (const r of monthRows) {
    const ts = new Date(r.created_at);
    if (ts < fourteenDaysAgo) continue;
    const day = ts.toISOString().slice(0, 10);
    const cur = dayBuckets.get(day) ?? { calls: 0, cost: 0 };
    cur.calls += 1;
    cur.cost += Number(r.cost_usd ?? 0);
    dayBuckets.set(day, cur);
  }
  const dailyTrend = [...dayBuckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Admin · Usage</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {user.email} · resets on the 1st UTC
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={String(totalUsersRes.count ?? 0)} />
        <Stat label="Active (7d)" value={String(activeUserIds.size)} />
        <Stat
          label="Calls (MTD)"
          value={totalCalls.toLocaleString()}
        />
        <Stat
          label="Spend (MTD)"
          value={`$${totalCost.toFixed(4)}`}
          subtle={`${totalTokens.toLocaleString()} tokens`}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Top spenders (30 days)
        </h2>
        {topSpenders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No usage yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-2">User</th>
                <th className="px-5 py-2 text-right">Calls</th>
                <th className="px-5 py-2 text-right">Tokens</th>
                <th className="px-5 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {topSpenders.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="px-5 py-2 font-medium">{u.name}</td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {u.calls}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {u.tokens.toLocaleString()}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    ${u.cost.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Daily trend (14 days)
        </h2>
        {dailyTrend.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            No usage in this window.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-2">Date (UTC)</th>
                <th className="px-5 py-2 text-right">Calls</th>
                <th className="px-5 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {dailyTrend.map(([day, stats]) => (
                <tr
                  key={day}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="px-5 py-2 tabular-nums">{day}</td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {stats.calls}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    ${stats.cost.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Recent calls
        </h2>
        <ul>
          {(recentChatRes.data ?? []).map((r, idx) => (
            <li
              key={`${r.user_id}-${r.created_at}-${idx}`}
              className="flex items-center justify-between border-b border-neutral-200 px-5 py-2 text-xs last:border-b-0 dark:border-neutral-800"
            >
              <span className="truncate font-mono text-neutral-500">
                {r.user_id.slice(0, 8)} · {r.source}
              </span>
              <span className="shrink-0 tabular-nums">
                {r.total_tokens} tok · ${Number(r.cost_usd).toFixed(4)} ·{" "}
                {new Date(r.created_at).toISOString().slice(11, 16)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {subtle && (
        <p className="mt-0.5 text-xs text-neutral-500">{subtle}</p>
      )}
    </div>
  );
}
