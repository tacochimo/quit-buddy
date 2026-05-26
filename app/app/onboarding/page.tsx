import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("quit_date")
    .eq("id", user.id)
    .single();

  // Already onboarded? Skip ahead.
  if (profile?.quit_date) redirect("/app/home");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Let&apos;s set you up</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          A few details so we can track your progress and savings.
        </p>
      </header>

      <OnboardingForm defaultQuitDate={today} />
    </main>
  );
}
