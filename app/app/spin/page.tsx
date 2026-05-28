import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OUTCOMES } from "@/lib/spin";
import { getLocalNow } from "@/lib/timezone";
import { SpinWheel } from "./wheel";

export const dynamic = "force-dynamic";

export default async function SpinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const today =
    getLocalNow(profile?.timezone ?? null)?.date ??
    new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("prize_spins")
    .select("outcome")
    .eq("user_id", user.id)
    .eq("spin_date", today)
    .maybeSingle();

  const initial = existing
    ? OUTCOMES.find((o) => o.id === existing.outcome) ?? null
    : null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Daily spin</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {initial
            ? "You've already spun today. Here's what you got:"
            : "One spin per day. Small wins, mostly. Tap to spin."}
        </p>
      </header>

      <SpinWheel initial={initial} />
    </main>
  );
}
