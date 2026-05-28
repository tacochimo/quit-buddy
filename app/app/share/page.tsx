import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateShareToken } from "@/lib/share";
import { ShareButton } from "./share-button";

export const dynamic = "force-dynamic";

export default async function ShareCardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = await getOrCreateShareToken(supabase, user.id);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const shareUrl = token ? `${siteUrl}/share/${token}` : null;
  const imagePath = token ? `/api/share/streak/${token}` : null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Share your streak</h1>
        <p className="mt-2 text-sm text-neutral-500">
          A small image you can post anywhere. Whoever taps it lands on a
          public page with your card and a one-tap sign-in for themselves.
        </p>
      </header>

      {imagePath && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm dark:border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePath}
            alt="Your streak card"
            width={1200}
            height={630}
            className="block w-full"
          />
        </div>
      )}

      {shareUrl && imagePath && (
        <ShareButton url={shareUrl} imagePath={imagePath} />
      )}

      {!shareUrl && (
        <p className="text-sm text-red-600">
          Couldn&apos;t generate a share link. Try refreshing.
        </p>
      )}

      <p className="text-center text-xs text-neutral-500">
        Anyone with the link can see this card. They can&apos;t see anything
        else.
      </p>
    </main>
  );
}
