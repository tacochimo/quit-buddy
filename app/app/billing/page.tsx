import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COACH_DAILY_LIMITS, type Tier } from "@/lib/subscription";
import { BillingActions } from "./actions";
import { PayPalButton } from "./paypal-button";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_tier, subscription_renews_at, stripe_customer_id, paypal_subscription_id, payment_provider",
    )
    .eq("id", user.id)
    .single();

  const tier: Tier = (profile?.subscription_tier as Tier) ?? "free";
  const renewsAt = profile?.subscription_renews_at
    ? new Date(profile.subscription_renews_at)
    : null;
  const hasStripe = Boolean(profile?.stripe_customer_id);
  const provider = profile?.payment_provider as
    | "stripe"
    | "paypal"
    | null
    | undefined;

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const paypalPlanId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID ?? "";
  const paypalEnabled = Boolean(paypalClientId && paypalPlanId);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Plan &amp; billing</h1>
      </header>

      {params.status === "success" && (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          Welcome to Plus — your daily coach limit is now{" "}
          {COACH_DAILY_LIMITS.plus}.
        </p>
      )}
      {params.status === "cancel" && (
        <p className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          No charge made. You can upgrade any time.
        </p>
      )}

      <section className="rounded-3xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Current plan
        </p>
        <p className="mt-1 text-3xl font-bold">
          {tier === "plus" ? "Plus" : "Free"}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {tier === "plus" && renewsAt
            ? `Renews ${renewsAt.toLocaleDateString()}`
            : `${COACH_DAILY_LIMITS[tier]} coach messages per day`}
        </p>
      </section>

      {tier === "free" ? (
        <section className="flex flex-col gap-4 rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-950/30">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Upgrade
            </p>
            <p className="mt-1 text-2xl font-bold">Quit Buddy Plus</p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              $4.99 / month · cancel any time
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            <Bullet>
              <strong>{COACH_DAILY_LIMITS.plus}</strong> coach messages per day
              (vs {COACH_DAILY_LIMITS.free} on Free)
            </Bullet>
            <Bullet>Same coach, same personas, same data — just more room</Bullet>
            <Bullet>Directly supports the cost of running the AI</Bullet>
          </ul>
          <BillingActions hasCustomer={hasStripe} tier={tier} />
          {paypalEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
                <span>or</span>
                <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
              </div>
              <PayPalButton
                clientId={paypalClientId}
                planId={paypalPlanId}
              />
            </>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-3xl border border-neutral-200 p-6 dark:border-neutral-800">
          {provider === "paypal" ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You&apos;re subscribed via PayPal. Manage or cancel in your
                PayPal account.
              </p>
              <a
                href="https://www.paypal.com/myaccount/autopay/"
                target="_blank"
                rel="noopener noreferrer"
                className="self-start rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Manage on PayPal →
              </a>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Manage payment method, view invoices, or cancel anytime.
              </p>
              <BillingActions hasCustomer={hasStripe} tier={tier} />
            </>
          )}
        </section>
      )}

      <p className="text-center text-xs text-neutral-500">
        Tracking, channels, games, the doctor PDF, plans, mood, prep, and
        everything else is free for everyone.
      </p>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="text-emerald-700 dark:text-emerald-400">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
