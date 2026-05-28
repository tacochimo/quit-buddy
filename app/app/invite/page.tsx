import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateReferralCode } from "@/lib/referral";
import { InviteShare } from "./invite-share";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = await getOrCreateReferralCode(supabase, user.id);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const shareUrl = code ? `${siteUrl}/?ref=${code}` : null;

  // How many referrals have qualified for this user, so they see momentum.
  const { count: qualifiedCount } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", user.id)
    .eq("status", "qualified");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Invite a friend</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Quitting alone is hard. When a friend joins and finishes setup, you
          both get a 🤝 referral star and 5 bonus coach messages a day for a
          week.
        </p>
      </header>

      {code && shareUrl ? (
        <section className="flex flex-col gap-4 rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-950/30">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Your code
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-wider">
              {code}
            </p>
            <p className="mt-2 text-xs text-neutral-500">{shareUrl}</p>
          </div>
          <InviteShare code={code} url={shareUrl} />
        </section>
      ) : (
        <p className="text-sm text-red-600">
          Couldn&apos;t generate a code. Refresh and try again.
        </p>
      )}

      <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          So far
        </p>
        <p className="mt-1 text-3xl font-bold">{qualifiedCount ?? 0}</p>
        <p className="text-sm text-neutral-500">
          {qualifiedCount === 1
            ? "friend has joined and finished setup"
            : "friends have joined and finished setup"}
        </p>
      </section>

      <p className="text-center text-xs text-neutral-500">
        Anyone with your link can sign up — your code only matters when they
        also finish onboarding (quit date + reasons + cigs/day).
      </p>
    </main>
  );
}
