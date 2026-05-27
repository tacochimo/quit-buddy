import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SlipForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SlipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">It happened. You&apos;re here.</h1>
        <p className="mt-2 text-sm text-neutral-500">
          No shame. Most successful quitters slip several times before it sticks.
          Tell me what happened so we can turn it into something useful.
        </p>
      </header>

      <SlipForm />
    </main>
  );
}
