import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/app/home");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Quit Buddy</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Quit smoking with people who have your back. Track your streak. Climb
        your channel&apos;s leaderboard. Earn stars for every milestone.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700"
      >
        Get started
      </Link>
    </main>
  );
}
