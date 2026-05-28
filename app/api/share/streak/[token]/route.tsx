import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSavings, computeStreak, earnedMilestones } from "@/lib/streak";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, display_name, baseline_cigs_per_day, cost_per_pack, cigs_per_pack",
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!profile) return new Response("Not found", { status: 404 });

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
  const days = streak.kind === "quit" ? streak.days : 0;
  const savings = computeSavings({
    days,
    cigsPerDay: profile.baseline_cigs_per_day,
    costPerPack: profile.cost_per_pack,
    cigsPerPack: profile.cigs_per_pack,
  });
  const milestones = earnedMilestones(days);
  const latestMilestone = milestones[milestones.length - 1] ?? null;
  const firstName =
    (profile.display_name ?? "").trim().split(/\s+/)[0] || "Someone";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #10b981, #047857)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.9 }}>
          <span style={{ fontSize: 28, fontWeight: 600 }}>
            {firstName} on Quit Buddy
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 240,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            {days}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              opacity: 0.95,
              marginTop: 8,
            }}
          >
            {days === 1 ? "day" : "days"} smoke-free
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 48 }}>
            <Stat label="Money saved" value={`$${savings.moneySaved.toFixed(0)}`} />
            <Stat
              label="Cigs avoided"
              value={savings.cigsAvoided.toLocaleString("en-US")}
            />
            {latestMilestone && (
              <Stat label="Milestone" value={`${latestMilestone}d star`} />
            )}
          </div>
          <div style={{ fontSize: 22, opacity: 0.7, alignSelf: "flex-end" }}>
            quitbuddy.app
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Refresh image at most every 5 minutes so a shared image stays
        // roughly current as the user's streak grows.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 18, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 44, fontWeight: 700, marginTop: 4 }}>
        {value}
      </span>
    </div>
  );
}
