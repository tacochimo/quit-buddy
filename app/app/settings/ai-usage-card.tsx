import { createClient } from "@/lib/supabase/server";
import { getMonthlyBudgetUsd } from "@/lib/ai-usage";

export async function AIUsageCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: thisMonth } = await supabase
    .from("ai_usage")
    .select("source, total_tokens, cost_usd")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());

  const rows = thisMonth ?? [];
  const totalCalls = rows.length;
  const totalTokens = rows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);
  const totalCost = rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  const coachCalls = rows.filter((r) => r.source === "coach").length;
  const nudgeCalls = rows.filter((r) => r.source === "nudge").length;

  const budget = getMonthlyBudgetUsd();
  const pct = budget > 0 ? Math.min(100, (totalCost / budget) * 100) : 0;
  const overBudget = budget > 0 && totalCost >= budget;
  const nearBudget = budget > 0 && pct >= 80 && !overBudget;

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-semibold">AI usage this month</h2>
      <p className="mt-1 text-sm text-neutral-500">
        OpenAI calls billed to your project (resets on the 1st UTC).
      </p>

      {totalCalls === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No coach activity yet this month.
        </p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tabular-nums">
            ${totalCost.toFixed(4)}
            {budget > 0 && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                / ${budget.toFixed(2)}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {totalCalls} call{totalCalls === 1 ? "" : "s"} ·{" "}
            {totalTokens.toLocaleString()} tokens · {coachCalls} chat,{" "}
            {nudgeCalls} nudge{nudgeCalls === 1 ? "" : "s"}
          </p>

          {budget > 0 && (
            <>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full transition-all ${
                    overBudget
                      ? "bg-red-500"
                      : nearBudget
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {overBudget && (
                <p className="mt-2 text-sm text-red-600">
                  Budget reached. Coach is paused until the 1st UTC.
                </p>
              )}
              {nearBudget && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  {pct.toFixed(0)}% of monthly budget used.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
