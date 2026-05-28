import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

async function loadStreak(token: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("share_token", token)
    .maybeSingle();
  if (!profile) return null;

  const { data: latest } = await admin
    .from("streak_events")
    .select("type, occurred_at")
    .eq("user_id", profile.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const streak = computeStreak(
    latest as { type: "quit" | "relapse"; occurred_at: string } | null,
  );
  const firstName =
    (profile.display_name ?? "").trim().split(/\s+/)[0] || "Someone";
  return {
    firstName,
    days: streak.kind === "quit" ? streak.days : 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadStreak(token);
  if (!data) return { title: "Quit Buddy" };
  const url = `${siteUrl()}/share/${token}`;
  const image = `${siteUrl()}/api/share/streak/${token}`;
  const title = `${data.firstName} is ${data.days} ${data.days === 1 ? "day" : "days"} smoke-free`;
  const description = "Quitting smoking with people who keep them honest.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadStreak(token);
  if (!data) notFound();
  const image = `/api/share/streak/${token}`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-12">
      <h1 className="text-center text-2xl font-bold sm:text-3xl">
        {data.firstName} is {data.days}{" "}
        {data.days === 1 ? "day" : "days"} smoke-free.
      </h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={`${data.firstName}'s streak`}
        width={1200}
        height={630}
        className="w-full max-w-xl rounded-2xl shadow-lg"
      />
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/login"
          className="rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700"
        >
          Start your own quit
        </Link>
        <p className="text-xs text-neutral-500">
          Free. Email magic-link login. No password.
        </p>
      </div>
    </main>
  );
}
