import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quit Buddy",
  description: "Quit smoking together. Track streaks, climb your channel leaderboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
