"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MILESTONES } from "@/lib/streak";

const WIDTH = 360;
const HEIGHT = 500;
const GROUND_H = 40;
const BIRD_X = 80;
const BIRD_R = 14;
const GRAVITY = 0.45;
const FLAP_V = -7.5;
const SCROLL_V = 2.5;
const PIPE_W = 50;

const GAP_START = 150;
const GAP_MIN = 110;
const SPACING_START = 220;
const SPACING_MIN = 160;
const RAMP_PIPES = 30;

const MILESTONE_LABEL: Record<number, string> = {
  1: "1 day!",
  7: "1 week!",
  30: "30 days!",
  90: "3 months!",
  180: "6 months!",
  365: "1 year smoke-free!",
  730: "2 years!",
};
const MILESTONE_SET = new Set<number>(MILESTONES);

const STORAGE_KEY = "embergo.flap.high";

type Pipe = {
  x: number;
  gapY: number; // top of gap
  gapH: number;
  passed: boolean;
};

type State = {
  running: boolean;
  over: boolean;
  birdY: number;
  vy: number;
  pipes: Pipe[];
  score: number;
  spawnInPx: number; // px until next spawn
  milestoneBanner: { text: string; ageMs: number } | null;
  lastT: number;
  rafId: number;
};

function initialState(): State {
  return {
    running: false,
    over: false,
    birdY: HEIGHT / 2,
    vy: 0,
    pipes: [],
    score: 0,
    spawnInPx: 120,
    milestoneBanner: null,
    lastT: 0,
    rafId: 0,
  };
}

function difficulty(score: number) {
  const t = Math.min(1, score / RAMP_PIPES);
  return {
    gap: GAP_START + (GAP_MIN - GAP_START) * t,
    spacing: SPACING_START + (SPACING_MIN - SPACING_START) * t,
  };
}

function newPipe(score: number): Pipe {
  const { gap } = difficulty(score);
  const minTop = 40;
  const maxTop = HEIGHT - GROUND_H - gap - 40;
  const gapY = minTop + Math.random() * (maxTop - minTop);
  return { x: WIDTH + PIPE_W, gapY, gapH: gap, passed: false };
}

// Lerp from smoky grey to clear sky as score climbs.
function bgColor(score: number): string {
  const t = Math.min(1, score / 100);
  // grey-brown #3f3f46 → sky #0ea5e9
  const r = Math.round(63 + (14 - 63) * t);
  const g = Math.round(63 + (165 - 63) * t);
  const b = Math.round(70 + (233 - 70) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawCigarette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  litAt: "bottom" | "top",
) {
  // Body
  ctx.fillStyle = "#f5f5f4";
  ctx.fillRect(x, y, w, h);
  // Wrap line
  ctx.strokeStyle = "#d6d3d1";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // Filter (tan band, opposite end from lit)
  const filterH = 22;
  ctx.fillStyle = "#b45309";
  if (litAt === "bottom") {
    ctx.fillRect(x, y, w, filterH);
    // Filter ribs
    ctx.fillStyle = "#92400e";
    ctx.fillRect(x, y + filterH - 4, w, 2);
    // Lit tip at bottom
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x, y + h - 4, w, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x + 4, y + h - 2, w - 8, 2);
  } else {
    ctx.fillRect(x, y + h - filterH, w, filterH);
    ctx.fillStyle = "#92400e";
    ctx.fillRect(x, y + h - filterH + 2, w, 2);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x + 4, y, w - 8, 2);
  }
}

export function FlapBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const bestRef = useRef(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Number.isFinite(stored) && stored > 0) {
      bestRef.current = stored;
      setBest(stored);
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    // Background
    ctx.fillStyle = bgColor(s.score);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ground
    ctx.fillStyle = "#15803d";
    ctx.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
    ctx.fillStyle = "#166534";
    for (let i = 0; i < WIDTH; i += 16) {
      ctx.fillRect(i, HEIGHT - GROUND_H, 8, 4);
    }

    // Pipes (cigarettes)
    for (const p of s.pipes) {
      // Top cigarette: filter at top, lit tip facing down into the gap
      drawCigarette(ctx, p.x, 0, PIPE_W, p.gapY, "bottom");
      // Bottom cigarette: filter at bottom, lit tip facing up into the gap
      const bottomY = p.gapY + p.gapH;
      const bottomH = HEIGHT - GROUND_H - bottomY;
      if (bottomH > 0) {
        drawCigarette(ctx, p.x, bottomY, PIPE_W, bottomH, "top");
      }
    }

    // Bird
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "32px ui-sans-serif, system-ui";
    ctx.save();
    ctx.translate(BIRD_X, s.birdY);
    // Tilt with velocity for feel
    const tilt = Math.max(-0.5, Math.min(1.2, s.vy / 10));
    ctx.rotate(tilt);
    ctx.fillText("🫁", 0, 0);
    ctx.restore();

    // HUD
    ctx.fillStyle = "#fafafa";
    ctx.textAlign = "center";
    ctx.font = "bold 28px ui-sans-serif, system-ui";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 3;
    const scoreText = String(s.score);
    ctx.strokeText(scoreText, WIDTH / 2, 48);
    ctx.fillText(scoreText, WIDTH / 2, 48);
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.lineWidth = 2;
    ctx.strokeText("DAYS SMOKE-FREE", WIDTH / 2, 66);
    ctx.fillText("DAYS SMOKE-FREE", WIDTH / 2, 66);

    if (bestRef.current > 0) {
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.lineWidth = 2;
      ctx.strokeText(`HI ${bestRef.current}`, 8, 16);
      ctx.fillText(`HI ${bestRef.current}`, 8, 16);
    }

    if (s.milestoneBanner) {
      const ageMs = s.milestoneBanner.ageMs;
      const alpha = Math.max(0, 1 - Math.max(0, ageMs - 800) / 400);
      const scale = 0.6 + Math.min(1, ageMs / 200) * 0.7;
      ctx.save();
      ctx.translate(WIDTH / 2, HEIGHT / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.font = "bold 28px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.strokeText(s.milestoneBanner.text, 0, 0);
      ctx.fillText(s.milestoneBanner.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (s.over) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#fafafa";
      ctx.textAlign = "center";
      ctx.font = "bold 20px ui-sans-serif, system-ui";
      ctx.fillText(
        `${s.score} ${s.score === 1 ? "day" : "days"} smoke-free`,
        WIDTH / 2,
        HEIGHT / 2 - 12,
      );
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.fillText("Tap to fly again", WIDTH / 2, HEIGHT / 2 + 16);
    } else if (!s.running) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#fafafa";
      ctx.textAlign = "center";
      ctx.font = "bold 18px ui-sans-serif, system-ui";
      ctx.fillText("Tap or press space", WIDTH / 2, HEIGHT / 2);
    }
  }, []);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.over = true;
    s.running = false;
    if (s.score > bestRef.current) {
      bestRef.current = s.score;
      localStorage.setItem(STORAGE_KEY, String(s.score));
      setBest(s.score);
    }
    setPhase("over");
    draw();
  }, [draw]);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!s.running) return;
      const dt = s.lastT === 0 ? 16 : Math.min(50, now - s.lastT);
      s.lastT = now;
      const scale = dt / (1000 / 60);

      s.vy += GRAVITY * scale;
      s.birdY += s.vy * scale;

      // Ground / ceiling
      if (s.birdY + BIRD_R >= HEIGHT - GROUND_H) {
        s.birdY = HEIGHT - GROUND_H - BIRD_R;
        endGame();
        return;
      }
      if (s.birdY - BIRD_R < 0) {
        s.birdY = BIRD_R;
        s.vy = 0;
      }

      // Pipes scroll
      for (const p of s.pipes) p.x -= SCROLL_V * scale;
      s.pipes = s.pipes.filter((p) => p.x + PIPE_W > 0);

      // Spawn
      s.spawnInPx -= SCROLL_V * scale;
      if (s.spawnInPx <= 0) {
        s.pipes.push(newPipe(s.score));
        s.spawnInPx = difficulty(s.score).spacing;
      }

      // Pass + collide
      for (const p of s.pipes) {
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          s.score += 1;
          if (MILESTONE_SET.has(s.score)) {
            s.milestoneBanner = {
              text: MILESTONE_LABEL[s.score] ?? `${s.score} days!`,
              ageMs: 0,
            };
          }
        }
        // Bird AABB-vs-pipe rectangles. Use bird circle's bounding box.
        const bxL = BIRD_X - BIRD_R;
        const bxR = BIRD_X + BIRD_R;
        const byT = s.birdY - BIRD_R;
        const byB = s.birdY + BIRD_R;
        if (bxR > p.x && bxL < p.x + PIPE_W) {
          if (byT < p.gapY || byB > p.gapY + p.gapH) {
            endGame();
            return;
          }
        }
      }

      if (s.milestoneBanner) {
        s.milestoneBanner.ageMs += dt;
        if (s.milestoneBanner.ageMs > 1200) s.milestoneBanner = null;
      }

      draw();
      s.rafId = requestAnimationFrame(loop);
    },
    [draw, endGame],
  );

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s.over || !s.running) {
      cancelAnimationFrame(s.rafId);
      stateRef.current = { ...initialState(), running: true };
      stateRef.current.vy = FLAP_V;
      setPhase("playing");
      stateRef.current.rafId = requestAnimationFrame(loop);
      return;
    }
    s.vy = FLAP_V;
  }, [loop]);

  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, [draw]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full max-w-md cursor-pointer touch-none rounded-2xl border border-neutral-200 dark:border-neutral-800"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
      />
      <p className="text-xs text-neutral-500">
        {best > 0 && (
          <>
            Best: <strong>{best}</strong> days
          </>
        )}
        {phase === "playing" && (best > 0 ? " · " : "") + "Each pipe = 1 day."}
      </p>
    </div>
  );
}
