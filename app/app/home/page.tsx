import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quit Buddy</h1>
        <SignOutButton />
      </header>

      <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm text-neutral-500">Signed in as</p>
        <p className="font-medium">{user?.email}</p>
      </section>

      <section className="rounded-2xl bg-emerald-50 p-6 dark:bg-emerald-950/40">
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Day counter, channels, leaderboard, and stars get built next.
        </p>
      </section>
    </main>
  );
}
