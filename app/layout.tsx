import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsProvider } from "./analytics-provider";

export const metadata: Metadata = {
  title: "Embergo",
  description: "Quit smoking together. Track streaks, climb your channel leaderboard.",
  appleWebApp: {
    capable: true,
    title: "Embergo",
    statusBarStyle: "default",
  },
  verification: {
    google: "tTS2gFzwyKPk1BXg3rbn7Tkh0ys6dXJgA2EbfoXADI8",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pull user.id here so the client provider can identify on first render.
  // Cheap — getUser() is already memoized by the supabase SSR helper.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Don't let analytics break the app shell.
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <AnalyticsProvider userId={userId} />
        {children}
      </body>
    </html>
  );
}
