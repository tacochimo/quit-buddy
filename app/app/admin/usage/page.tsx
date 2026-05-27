import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { getMonthlyBudgetUsd } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

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

  // Per-user MTD spend, for cap-hit rate and distribution.
  const budget = getMonthlyBudgetUsd();
  const perUserMtd = new Map<string, { cost: number; coach: number; nudge: number }>();
  for (const r of monthRows) {
    const cur = perUserMtd.get(r.user_id) ?? { cost: 0, coach: 0, nudge: 0 };
    const c = Number(r.cost_usd ?? 0);
    cur.cost += c;
    if (r.source === "coach") cur.coach += c;
    else if (r.source === "nudge") cur.nudge += c;
    perUserMtd.set(r.user_id, cur);
  }
  const userCosts = [...perUserMtd.values()].map((u) => u.cost).sort((a, b) => a - b);
  const usersWithUsage = userCosts.length;
  const capHit = budget > 0 ? userCosts.filter((c) => c >= budget).length : 0;
  const capNear =
    budget > 0
      ? userCosts.filter((c) => c >= budget * 0.9 && c < budget).length
      : 0;
  const p50 = percentile(userCosts, 50);
  const p90 = percentile(userCosts, 90);
  const p99 = percentile(userCosts, 99);
  const meanCost = usersWithUsage > 0 ? totalCost / usersWithUsage : 0;

  // Source split (MTD).
  const coachCost = monthRows
    .filter((r) => r.source === "coach")
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const nudgeCost = monthRows
    .filter((r) => r.source === "nudge")
    .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const coachCalls = monthRows.filter((r) => r.source === "coach").length;
  const nudgeCalls = monthRows.filter((r) => r.source === "nudge").length;

  // Month-end projection: linear extrapolation by elapsed/total days in month.
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const msInMonth = monthEnd.getTime() - monthStart.getTime();
  const msElapsed = Math.max(1, now.getTime() - monthStart.getTime());
  const fractionElapsed = msElapsed / msInMonth;
  const projectedMonthCost = totalCost / fractionElapsed;
  const projectedPerUser =
    usersWithUsage > 0 ? projectedMonthCost / usersWithUsage : 0;

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
          Cap-hit rate (MTD)
        </h2>
        {budget === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            Budget enforcement disabled (COACH_MONTHLY_BUDGET_USD=0).
          </p>
        ) : usersWithUsage === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No usage yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
            <Stat
              label="Budget"
              value={`$${budget.toFixed(2)}`}
              subtle="per user / month"
            />
            <Stat
              label="At cap"
              value={`${capHit} / ${usersWithUsage}`}
              subtle={`${((capHit / usersWithUsage) * 100).toFixed(1)}% of users`}
            />
            <Stat
              label="Within 10%"
              value={`${capNear} / ${usersWithUsage}`}
              subtle={`${((capNear / usersWithUsage) * 100).toFixed(1)}% of users`}
            />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Spend distribution (MTD)
        </h2>
        {usersWithUsage === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No usage yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            <Stat
              label="Mean"
              value={`$${meanCost.toFixed(4)}`}
              subtle={`${usersWithUsage} users w/ usage`}
            />
            <Stat label="P50" value={`$${p50.toFixed(4)}`} />
            <Stat label="P90" value={`$${p90.toFixed(4)}`} />
            <Stat label="P99" value={`$${p99.toFixed(4)}`} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Source split (MTD)
        </h2>
        {totalCalls === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No usage yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-5">
            <Stat
              label="Coach"
              value={`$${coachCost.toFixed(4)}`}
              subtle={`${coachCalls.toLocaleString()} calls · ${((coachCost / Math.max(totalCost, 1e-9)) * 100).toFixed(0)}% of spend`}
            />
            <Stat
              label="Nudge"
              value={`$${nudgeCost.toFixed(4)}`}
              subtle={`${nudgeCalls.toLocaleString()} calls · ${((nudgeCost / Math.max(totalCost, 1e-9)) * 100).toFixed(0)}% of spend`}
            />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          Month-end projection
        </h2>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          <Stat
            label="Elapsed"
            value={`${(fractionElapsed * 100).toFixed(0)}%`}
            subtle="of UTC month"
          />
          <Stat
            label="Projected spend"
            value={`$${projectedMonthCost.toFixed(4)}`}
            subtle="linear from MTD"
          />
          <Stat
            label="Projected / user"
            value={`$${projectedPerUser.toFixed(4)}`}
            subtle={
              budget > 0
                ? `${((projectedPerUser / budget) * 100).toFixed(0)}% of $${budget.toFixed(2)} cap`
                : "no cap set"
            }
          />
        </div>
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
