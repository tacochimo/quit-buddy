"use client";

import { useEffect, useState } from "react";
import type { Companion } from "@/lib/companions";

type Mode = "idle" | "typing" | "celebrate";

export function CoachCompanion({
  companion,
  typing,
  milestoneDay,
}: {
  companion: Companion;
  typing: boolean;
  milestoneDay: number | null;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [arrived, setArrived] = useState(false);

  // One-time arrive animation on mount.
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Milestone celebration — fires once per (browser, day) using localStorage.
  useEffect(() => {
    if (!milestoneDay) return;
    const key = `quitbuddy.companion.celebrated.${milestoneDay}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    setMode("celebrate");
    window.localStorage.setItem(key, "1");
    const t = setTimeout(() => setMode("idle"), 2800);
    return () => clearTimeout(t);
  }, [milestoneDay]);

  // Typing reaction takes precedence over idle but not over celebrate.
  useEffect(() => {
    setMode((prev) => {
      if (prev === "celebrate") return prev;
      return typing ? "typing" : "idle";
    });
  }, [typing]);

  // Pick the right animation class for the current mode + arrival state.
  let animClass = "animate-companion-idle";
  if (!arrived) animClass = "animate-companion-arrive opacity-0";
  else if (mode === "typing") animClass = "animate-companion-typing";
  else if (mode === "celebrate") animClass = "animate-companion-celebrate";

  return (
    <div
      className="pointer-events-none flex items-end justify-end px-2 pb-1 pt-2"
      aria-hidden
    >
      <div className="relative">
        {mode === "celebrate" && <Sparkles />}
        <div
          className={`text-3xl leading-none drop-shadow-sm ${animClass}`}
          style={{ willChange: "transform" }}
        >
          {companion.emoji}
        </div>
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
