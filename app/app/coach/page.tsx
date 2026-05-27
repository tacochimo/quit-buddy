import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "./chat";
import { getCoachUsage } from "./actions";
import { getPersona } from "@/lib/personas";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const configured = Boolean(process.env.OPENAI_API_KEY);
  const usage = await getCoachUsage();
  const remaining = Math.max(0, usage.limit - usage.used);

  const { data: profile } = await supabase
    .from("profiles")
    .select("coach_persona")
    .eq("id", user.id)
    .single();
  const persona = getPersona(profile?.coach_persona);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-xl flex-col px-4 pb-4 pt-4">
      <header className="flex items-center justify-between pb-3">
        <div>
          <Link
            href="/app/home"
            className="text-sm text-neutral-500 hover:underline"
          >
            ← Home
          </Link>
          <h1 className="mt-1 text-xl font-bold">
            <span aria-hidden className="mr-1">
              {persona.emoji}
            </span>
            {persona.name}
            {remaining <= 5 && (
              <span
                className={`ml-2 text-xs font-normal ${
                  remaining === 0
                    ? "text-red-600"
                    : "text-neutral-500"
                }`}
              >
                {remaining}/{usage.limit} left today
              </span>
            )}
          </h1>
          <Link
            href="/app/settings#persona"
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            change companion
          </Link>
        </div>
        {messages && messages.length > 0 && <ClearButton />}
      </header>

      {!configured && (
        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          OpenAI isn&apos;t configured. Set <code>OPENAI_API_KEY</code> in Vercel
          to enable the coach.
        </div>
      )}

      <CoachChat
        initialMessages={
          (messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })) ?? []
        }
        disabled={!configured}
      />
    </main>
  );
}

function ClearButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { clearCoachHistory } = await import("./actions");
        await clearCoachHistory();
      }}
    >
      <button
        type="submit"
        className="text-xs text-neutral-500 underline hover:text-neutral-700"
      >
        Clear chat
      </button>
    </form>
  );
}
