"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to channel-relevant Postgres changes and triggers a server
// refresh. RLS scopes what each client receives, so cross-channel noise is
// limited to events for users you can already see.
export function RealtimeRefresher({ channelId }: { channelId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 250);
    };

    const channel = supabase
      .channel(`channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reactions",
          filter: `channel_id=eq.${channelId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_members",
          filter: `channel_id=eq.${channelId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "streak_events" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stars" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sos_signals",
          filter: `channel_id=eq.${channelId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [channelId, router]);

  return null;
}
