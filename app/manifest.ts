import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quit Buddy",
    short_name: "Quit Buddy",
    description:
      "Quit smoking together. Track streaks. Climb your channel leaderboard.",
    start_url: "/app/home",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Log a craving",
        short_name: "Craving",
        description: "Log what you're feeling right now",
        url: "/app/cravings",
      },
      {
        name: "Talk to coach",
        short_name: "Coach",
        description: "Chat with your AI companion",
        url: "/app/coach",
      },
      {
        name: "Log a dose",
        short_name: "Meds",
        description: "Track NRT or medication",
        url: "/app/meds",
      },
      {
        name: "I slipped",
        short_name: "Slip",
        description: "Capture a slip without resetting your streak",
        url: "/app/slip",
      },
    ],
  };
}
