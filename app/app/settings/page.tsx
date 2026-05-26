import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, quit_date, baseline_cigs_per_day, cost_per_pack, cigs_per_pack",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.quit_date) redirect("/app/onboarding");

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-neutral-500">{user.email}</p>
      </header>

      <SettingsForm
        defaults={{
          display_name: profile.display_name,
          quit_date: profile.quit_date.slice(0, 10),
          baseline_cigs_per_day: profile.baseline_cigs_per_day ?? 10,
          cost_per_pack: profile.cost_per_pack ?? 8,
          cigs_per_pack: profile.cigs_per_pack ?? 20,
        }}
      />
    </main>
  );
}
