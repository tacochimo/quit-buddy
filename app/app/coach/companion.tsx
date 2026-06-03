"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Companion } from "@/lib/companions";
import type { Tier } from "@/lib/subscription";

type Mode = "idle" | "typing" | "celebrate" | "trick";

type Trick = {
  id: string;
  className: string;
  durationMs: number;
  emote?: string; // optional small overlay (e.g. "💤")
};

const FREE_TRICKS: Trick[] = [
  { id: "hop", className: "animate-companion-hop", durationMs: 500 },
  { id: "spin", className: "animate-companion-spin", durationMs: 600 },
  { id: "wiggle", className: "animate-companion-wiggle", durationMs: 600 },
];

const PLUS_TRICKS: Trick[] = [
  ...FREE_TRICKS,
  { id: "backflip", className: "animate-companion-backflip", durationMs: 800 },
  { id: "dance", className: "animate-companion-dance", durationMs: 900 },
  { id: "dizzy", className: "animate-companion-dizzy", durationMs: 900 },
  {
    id: "sleep",
    className: "animate-companion-sleep",
    durationMs: 2800,
    emote: "💤",
  },
];

const TAP_COOLDOWN_MS = 250;
const FREE_TAP_HINT_AT = 4; // show "More tricks on Plus" after this many free taps

export function CoachCompanion({
  companion,
  typing,
  milestoneDay,
  tier,
  tricksUnlocked = false,
  sparkle = false,
}: {
  companion: Companion;
  typing: boolean;
  milestoneDay: number | null;
  tier: Tier;
  tricksUnlocked?: boolean;
  sparkle?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [arrived, setArrived] = useState(false);
  const [trickClass, setTrickClass] = useState<string | null>(null);
  const [trickEmote, setTrickEmote] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const trickIdxRef = useRef(0);
  const lastTapRef = useRef(0);
  const trickTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  // One-time arrive animation on mount.
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Milestone celebration — fires once per (browser, day) using localStorage.
  useEffect(() => {
    if (!milestoneDay) return;
    const key = `lastember.companion.celebrated.${milestoneDay}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    setMode("celebrate");
    window.localStorage.setItem(key, "1");
    const t = setTimeout(() => setMode("idle"), 2800);
    return () => clearTimeout(t);
  }, [milestoneDay]);

  // Typing reaction takes precedence over idle, never over celebrate/trick.
  useEffect(() => {
    setMode((prev) => {
      if (prev === "celebrate" || prev === "trick") return prev;
      return typing ? "typing" : "idle";
    });
  }, [typing]);

  function doTrick() {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_COOLDOWN_MS) return;
    lastTapRef.current = now;

    const pool = tier === "plus" || tricksUnlocked ? PLUS_TRICKS : FREE_TRICKS;
    const trick = pool[trickIdxRef.current % pool.length];
    trickIdxRef.current += 1;

    setMode("trick");
    setTrickClass(trick.className);
    setTrickEmote(trick.emote ?? null);

    if (trickTimerRef.current) window.clearTimeout(trickTimerRef.current);
    trickTimerRef.current = window.setTimeout(() => {
      setTrickClass(null);
      setTrickEmote(null);
      setMode(typing ? "typing" : "idle");
    }, trick.durationMs);

    // Free users: after a few taps, show the upsell hint once per page mount.
    // Skip when today's spin already unlocked tricks.
    if (tier === "free" && !tricksUnlocked) {
      const nextCount = tapCount + 1;
      setTapCount(nextCount);
      if (!hintShown && nextCount >= FREE_TAP_HINT_AT) {
        setHintShown(true);
        if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = window.setTimeout(
          () => setHintShown(false),
          6000,
        );
      }
    }
  }

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      if (trickTimerRef.current) window.clearTimeout(trickTimerRef.current);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, []);

  // Pick the right animation class.
  let animClass = "animate-companion-idle";
  if (!arrived) animClass = "animate-companion-arrive opacity-0";
  else if (mode === "trick" && trickClass) animClass = trickClass;
  else if (mode === "typing") animClass = "animate-companion-typing";
  else if (mode === "celebrate") animClass = "animate-companion-celebrate";

  return (
    <div className="relative flex items-end justify-end px-2 pb-1 pt-2">
      <div className="relative">
        {sparkle && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -m-2 rounded-full bg-amber-300/40 blur-md animate-companion-idle"
            style={{ animationDuration: "2.4s" }}
          />
        )}
        {mode === "celebrate" && <Sparkles />}
        {trickEmote && (
          <span
            className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-xs animate-companion-sparkle"
            aria-hidden
          >
            {trickEmote}
          </span>
        )}
        <button
          type="button"
          onClick={doTrick}
          className={`cursor-pointer text-3xl leading-none drop-shadow-sm transition-transform active:scale-95 ${animClass}`}
          style={{ willChange: "transform" }}
          aria-label={`Pet your ${companion.label.toLowerCase()}`}
        >
          {companion.emoji}
        </button>
        {hintShown && tier === "free" && (
          <div
            role="status"
            className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            More tricks on{" "}
            <Link href="/app/billing" className="font-semibold underline">
              Plus
            </Link>
            : backflip, dance, dizzy, sleep.
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkles() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="absolute text-xs animate-companion-sparkle"
          style={{
            left: `${i * 8 - 16}px`,
            top: "8px",
            animationDelay: `${i * 80}ms`,
          }}
        >
          ✨
        </span>
      ))}
    </>
  );
}
