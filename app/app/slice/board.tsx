"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WIDTH = 360;
const HEIGHT = 500;
const FRUIT_R = 22;
const GRAVITY = 0.4; // px / frame^2 at 60fps
const TRAIL_MS = 200;
const STARTING_LIVES = 3;
const ROUND_MS = 60_000;
const SPAWN_MIN_MS = 600;
const SPAWN_MAX_MS = 1400;
const FRUIT_GLYPHS = ["🍎", "🍊", "🍋", "🍇", "🍉", "🍓"];
const BOMB_GLYPH = "💣";
const BOMB_CHANCE = 0.1;
const COMBO_BONUS = [0, 0, 2, 5, 10, 15]; // index = swipe count

const STORAGE_KEY = "quitbuddy.slice.high";

type Fruit = {
  id: number;
  type: "fruit" | "bomb";
  glyph: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  sliced: boolean;
  sliceAge: number;
  alive: boolean;
};

type TrailPt = { x: number; y: number; t: number };

type State = {
  running: boolean;
  over: boolean;
  fruits: Fruit[];
  trail: TrailPt[];
  score: number;
  lives: number;
  msLeft: number;
  spawnInMs: number;
  comboCount: number;
  comboBanner: { text: string; ageMs: number; x: number; y: number } | null;
  lastT: number;
  rafId: number;
  nextId: number;
};

function initialState(): State {
  return {
    running: false,
    over: false,
    fruits: [],
    trail: [],
    score: 0,
    lives: STARTING_LIVES,
    msLeft: ROUND_MS,
    spawnInMs: 600,
    comboCount: 0,
    comboBanner: null,
    lastT: 0,
    rafId: 0,
    nextId: 1,
  };
}

function spawnWave(s: State) {
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const isBomb = Math.random() < BOMB_CHANCE;
    const x = 40 + Math.random() * (WIDTH - 80);
    const centerLean = (WIDTH / 2 - x) * 0.012;
    s.fruits.push({
      id: s.nextId++,
      type: isBomb ? "bomb" : "fruit",
      glyph: isBomb
        ? BOMB_GLYPH
        : FRUIT_GLYPHS[Math.floor(Math.random() * FRUIT_GLYPHS.length)],
      x,
      y: HEIGHT + 40,
      vx: centerLean + (Math.random() - 0.5) * 2,
      vy: -(12 + Math.random() * 4),
      rot: 0,
      vrot: (Math.random() - 0.5) * 0.25,
      sliced: false,
      sliceAge: 0,
      alive: true,
    });
  }
  s.spawnInMs = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
}

// Distance from point C to segment AB ≤ r ?
function segHitsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let px: number;
  let py: number;
  if (len2 === 0) {
    px = ax;
    py = ay;
  } else {
    let t = ((cx - ax) * dx + (cy - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    px = ax + t * dx;
    py = ay + t * dy;
  }
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy <= r * r;
}

export function SliceBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initialState());
  const bestRef = useRef(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [, force] = useState(0);

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
    const isDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const bg = isDark ? "#0a0a0a" : "#fafafa";
    const fg = isDark ? "#f5f5f5" : "#171717";
    const dim = isDark ? "#525252" : "#a3a3a3";
    const accent = "#10b981";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Trail (oldest first, fading)
    if (s.trail.length >= 2) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const now = performance.now();
      for (let i = 1; i < s.trail.length; i += 1) {
        const a = s.trail[i - 1];
        const b = s.trail[i];
        const age = now - b.t;
        const alpha = Math.max(0, 1 - age / TRAIL_MS);
        if (alpha <= 0) continue;
        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.lineWidth = 6 * alpha + 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Fruits
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "32px ui-sans-serif, system-ui";
    for (const f of s.fruits) {
      if (!f.alive) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      if (f.sliced) {
        const alpha = Math.max(0, 1 - f.sliceAge / 500);
        ctx.globalAlpha = alpha;
      }
      ctx.fillText(f.glyph, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = fg;
    ctx.fillText(String(s.score).padStart(4, "0"), WIDTH - 8, 18);
    ctx.textAlign = "left";
    if (bestRef.current > 0) {
      ctx.fillStyle = dim;
      ctx.fillText(`HI ${String(bestRef.current).padStart(4, "0")}`, 8, 18);
    }
    // Lives
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.font = "16px ui-sans-serif, system-ui";
    ctx.fillText("❤".repeat(s.lives) + "·".repeat(STARTING_LIVES - s.lives), WIDTH / 2, 18);
    // Timer
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "right";
    const sec = Math.max(0, Math.ceil(s.msLeft / 1000));
    ctx.fillStyle = sec <= 10 ? "#dc2626" : dim;
    ctx.fillText(`${sec}s`, WIDTH - 8, 34);

    // Combo banner
    if (s.comboBanner) {
      const alpha = Math.max(0, 1 - s.comboBanner.ageMs / 700);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.font = "bold 18px ui-sans-serif, system-ui";
      ctx.fillText(
        s.comboBanner.text,
        s.comboBanner.x,
        s.comboBanner.y - 30,
      );
      ctx.globalAlpha = 1;
    }

    if (s.over) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 18px ui-sans-serif, system-ui";
      ctx.fillText("Game over · tap to retry", WIDTH / 2, HEIGHT / 2);
    } else if (!s.running) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 18px ui-sans-serif, system-ui";
      ctx.fillText("Tap to start", WIDTH / 2, HEIGHT / 2);
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = dim;
      ctx.fillText("then swipe to slice", WIDTH / 2, HEIGHT / 2 + 22);
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

      // Timer
      s.msLeft -= dt;
      if (s.msLeft <= 0) {
        endGame();
        return;
      }

      // Spawn
      s.spawnInMs -= dt;
      if (s.spawnInMs <= 0) spawnWave(s);

      // Fruit physics
      for (const f of s.fruits) {
        if (!f.alive) continue;
        f.x += f.vx * scale;
        f.y += f.vy * scale;
        f.vy += GRAVITY * scale;
        f.rot += f.vrot * scale;
        if (f.sliced) {
          f.sliceAge += dt;
          if (f.sliceAge > 500) f.alive = false;
        }
        // Off-screen: miss if it was an un-sliced fruit
        if (f.y > HEIGHT + 60 || f.x < -60 || f.x > WIDTH + 60) {
          if (!f.sliced && f.type === "fruit" && f.alive) {
            s.lives -= 1;
            if (s.lives <= 0) {
              f.alive = false;
              endGame();
              return;
            }
          }
          f.alive = false;
        }
      }
      s.fruits = s.fruits.filter((f) => f.alive);

      // Trail expiry
      s.trail = s.trail.filter((p) => now - p.t < TRAIL_MS);

      // Combo banner age
      if (s.comboBanner) {
        s.comboBanner.ageMs += dt;
        if (s.comboBanner.ageMs > 700) s.comboBanner = null;
      }

      draw();
      s.rafId = requestAnimationFrame(loop);
    },
    [draw, endGame],
  );

  const start = useCallback(() => {
    cancelAnimationFrame(stateRef.current.rafId);
    stateRef.current = { ...initialState(), running: true };
    setPhase("playing");
    stateRef.current.rafId = requestAnimationFrame(loop);
  }, [loop]);

  // Initial draw + cleanup
  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, [draw]);

  // Pointer handling: track a continuous swipe; on each move, test the new
  // segment against every live fruit/bomb.
  const swipeActiveRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = stateRef.current;
    if (!s.running || s.over) {
      start();
      return;
    }
    swipeActiveRef.current = true;
    s.comboCount = 0;
    const p = canvasPoint(e);
    lastPointRef.current = p;
    s.trail.push({ x: p.x, y: p.y, t: performance.now() });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!swipeActiveRef.current) return;
    const s = stateRef.current;
    if (!s.running || s.over) return;
    const prev = lastPointRef.current;
    const p = canvasPoint(e);
    lastPointRef.current = p;
    s.trail.push({ x: p.x, y: p.y, t: performance.now() });
    if (!prev) return;

    // Hit detection: segment prev → p vs each live, un-sliced fruit
    let slicedThisMove = 0;
    let lastSliceX = 0;
    let lastSliceY = 0;
    for (const f of s.fruits) {
      if (!f.alive || f.sliced) continue;
      if (segHitsCircle(prev.x, prev.y, p.x, p.y, f.x, f.y, FRUIT_R)) {
        if (f.type === "bomb") {
          endGame();
          return;
        }
        f.sliced = true;
        f.vy -= 4; // small upward kick on slice
        f.vx += (Math.random() - 0.5) * 4;
        f.vrot += (Math.random() - 0.5) * 0.4;
        s.score += 1;
        s.comboCount += 1;
        slicedThisMove += 1;
        lastSliceX = f.x;
        lastSliceY = f.y;
      }
    }
    if (slicedThisMove > 0 && s.comboCount >= 2) {
      const bonus =
        COMBO_BONUS[Math.min(s.comboCount, COMBO_BONUS.length - 1)];
      if (bonus > 0) {
        s.score += bonus;
        s.comboBanner = {
          text: `×${s.comboCount} +${bonus}`,
          ageMs: 0,
          x: lastSliceX,
          y: lastSliceY,
        };
      }
    }
    force((n) => (n + 1) % 1_000_000);
  }

  function onPointerUp() {
    swipeActiveRef.current = false;
    lastPointRef.current = null;
    stateRef.current.comboCount = 0;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full max-w-md cursor-crosshair touch-none rounded-2xl border border-neutral-200 dark:border-neutral-800"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <p className="text-xs text-neutral-500">
        {best > 0 && (
          <>
            Best: <strong>{best}</strong>
          </>
        )}
        {phase === "playing" && (best > 0 ? " · " : "") + "Avoid 💣."}
      </p>
    </div>
  );
}
