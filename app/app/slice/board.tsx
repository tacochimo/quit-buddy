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
const HALF_LIFE_MS = 900;
const PARTICLE_LIFE_MS = 700;

const FRUIT_GLYPHS = ["🍎", "🍊", "🍋", "🍇", "🍉", "🍓"];
const BOMB_GLYPH = "💣";
const BOMB_CHANCE = 0.1;
const COMBO_BONUS = [0, 0, 2, 5, 10, 15]; // index = swipe count

const JUICE_COLOR: Record<string, string> = {
  "🍎": "#dc2626",
  "🍊": "#f97316",
  "🍋": "#facc15",
  "🍇": "#7c3aed",
  "🍉": "#ec4899",
  "🍓": "#e11d48",
};
const BOMB_COLOR = "#525252";

const STORAGE_KEY = "lastember.slice.high";

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
};

type Half = {
  glyph: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  side: "upper" | "lower";
  sliceAngleLocal: number; // slice axis in piece-local frame
  ageMs: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  ageMs: number;
  lifeMs: number;
};

type TrailPt = { x: number; y: number; t: number };

type State = {
  running: boolean;
  over: boolean;
  fruits: Fruit[];
  halves: Half[];
  particles: Particle[];
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
    halves: [],
    particles: [],
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
    });
  }
  s.spawnInMs = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
}

function spawnSliceFx(
  s: State,
  f: Fruit,
  sliceAngleWorld: number,
  sliceVx: number,
  sliceVy: number,
) {
  // Two halves: split perpendicular to the slice direction.
  const perp = sliceAngleWorld + Math.PI / 2;
  const kick = 3;
  const sliceAngleLocal = sliceAngleWorld - f.rot;
  for (const side of ["upper", "lower"] as const) {
    const sign = side === "upper" ? -1 : 1;
    s.halves.push({
      glyph: f.glyph,
      x: f.x,
      y: f.y,
      vx: f.vx + Math.cos(perp) * kick * sign + sliceVx * 0.15,
      vy: f.vy + Math.sin(perp) * kick * sign + sliceVy * 0.15 - 1,
      rot: f.rot,
      vrot: f.vrot + (Math.random() - 0.5) * 0.3,
      side,
      sliceAngleLocal,
      ageMs: 0,
    });
  }

  // Juice particles.
  const color = JUICE_COLOR[f.glyph] ?? "#10b981";
  for (let i = 0; i < 9; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    s.particles.push({
      x: f.x,
      y: f.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      r: 2 + Math.random() * 3,
      color,
      ageMs: 0,
      lifeMs: PARTICLE_LIFE_MS,
    });
  }
}

function spawnBombBoom(s: State, f: Fruit) {
  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 5;
    s.particles.push({
      x: f.x,
      y: f.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 4,
      color: Math.random() < 0.3 ? "#f59e0b" : BOMB_COLOR,
      ageMs: 0,
      lifeMs: PARTICLE_LIFE_MS,
    });
  }
}

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

    // Trail
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

    // Particles (under fruits)
    for (const p of s.particles) {
      const alpha = Math.max(0, 1 - p.ageMs / p.lifeMs);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fruits (whole)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "32px ui-sans-serif, system-ui";
    for (const f of s.fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.fillText(f.glyph, 0, 0);
      ctx.restore();
    }

    // Halves (clipped)
    for (const h of s.halves) {
      const alpha = Math.max(0, 1 - h.ageMs / HALF_LIFE_MS);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      // Rotate into slice-aligned local frame, clip to half-plane.
      ctx.rotate(h.sliceAngleLocal);
      ctx.beginPath();
      const R = 40;
      if (h.side === "upper") {
        ctx.rect(-R, -R, 2 * R, R);
      } else {
        ctx.rect(-R, 0, 2 * R, R);
      }
      ctx.clip();
      // Rotate back so glyph is upright in piece-local frame.
      ctx.rotate(-h.sliceAngleLocal);
      ctx.globalAlpha = alpha;
      ctx.fillText(h.glyph, 0, 0);
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
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.font = "16px ui-sans-serif, system-ui";
    ctx.fillText(
      "❤".repeat(s.lives) + "·".repeat(STARTING_LIVES - s.lives),
      WIDTH / 2,
      18,
    );
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "right";
    const sec = Math.max(0, Math.ceil(s.msLeft / 1000));
    ctx.fillStyle = sec <= 10 ? "#dc2626" : dim;
    ctx.fillText(`${sec}s`, WIDTH - 8, 34);

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

      s.msLeft -= dt;
      if (s.msLeft <= 0) {
        endGame();
        return;
      }

      s.spawnInMs -= dt;
      if (s.spawnInMs <= 0) spawnWave(s);

      // Fruits
      for (const f of s.fruits) {
        f.x += f.vx * scale;
        f.y += f.vy * scale;
        f.vy += GRAVITY * scale;
        f.rot += f.vrot * scale;
      }
      const fruitsBefore = s.fruits.length;
      const survived: Fruit[] = [];
      for (const f of s.fruits) {
        const offBottom = f.y > HEIGHT + 60;
        const offSide = f.x < -60 || f.x > WIDTH + 60;
        if (offBottom || offSide) {
          if (f.type === "fruit") {
            s.lives -= 1;
            if (s.lives <= 0) {
              endGame();
              return;
            }
          }
          continue;
        }
        survived.push(f);
      }
      if (survived.length !== fruitsBefore) s.fruits = survived;

      // Halves
      for (const h of s.halves) {
        h.x += h.vx * scale;
        h.y += h.vy * scale;
        h.vy += GRAVITY * scale;
        h.rot += h.vrot * scale;
        h.ageMs += dt;
      }
      s.halves = s.halves.filter(
        (h) => h.ageMs < HALF_LIFE_MS && h.y < HEIGHT + 80,
      );

      // Particles
      for (const p of s.particles) {
        p.x += p.vx * scale;
        p.y += p.vy * scale;
        p.vy += GRAVITY * scale * 0.6;
        p.ageMs += dt;
      }
      s.particles = s.particles.filter((p) => p.ageMs < p.lifeMs);

      // Trail expiry
      s.trail = s.trail.filter((p) => now - p.t < TRAIL_MS);

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

  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, [draw]);

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

    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const sliceAngle = Math.atan2(dy, dx);

    let slicedThisMove = 0;
    let lastSliceX = 0;
    let lastSliceY = 0;
    const survivors: Fruit[] = [];
    for (const f of s.fruits) {
      if (!segHitsCircle(prev.x, prev.y, p.x, p.y, f.x, f.y, FRUIT_R)) {
        survivors.push(f);
        continue;
      }
      if (f.type === "bomb") {
        spawnBombBoom(s, f);
        endGame();
        return;
      }
      spawnSliceFx(s, f, sliceAngle, dx, dy);
      s.score += 1;
      s.comboCount += 1;
      slicedThisMove += 1;
      lastSliceX = f.x;
      lastSliceY = f.y;
    }
    if (slicedThisMove > 0) s.fruits = survivors;

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
