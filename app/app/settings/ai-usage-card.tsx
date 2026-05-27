import { createClient } from "@/lib/supabase/server";

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
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {totalCalls} call{totalCalls === 1 ? "" : "s"} ·{" "}
            {totalTokens.toLocaleString()} tokens · {coachCalls} chat,{" "}
            {nudgeCalls} nudge{nudgeCalls === 1 ? "" : "s"}
          </p>
        </>
      )}
    </section>
  );
}
