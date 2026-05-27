import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./form";
import { NotificationsToggle } from "./notifications-toggle";
import { NudgeTest } from "./nudge-test";
import { AIUsageCard } from "./ai-usage-card";
import { isAdminEmail } from "@/lib/admin";

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
      "display_name, quit_date, baseline_cigs_per_day, cost_per_pack, cigs_per_pack, reasons, savings_goal_name, savings_goal_amount, coach_persona",
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
          reasons: profile.reasons ?? "",
          savings_goal_name: profile.savings_goal_name ?? "",
          savings_goal_amount: profile.savings_goal_amount ?? "",
          coach_persona: profile.coach_persona ?? "friend",
        }}
      />

      <NotificationsToggle
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />

      <AIUsageCard />

      <NudgeTest />

      {isAdminEmail(user.email ?? null) && (
        <div className="text-center">
          <Link
            href="/app/admin/usage"
            className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Admin · Usage dashboard
          </Link>
        </div>
      )}
    </main>
  );
}
