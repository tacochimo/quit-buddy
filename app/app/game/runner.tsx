"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WIDTH = 360;
const HEIGHT = 140;
const GROUND_Y = 120;
const GRAVITY = 0.6;
const JUMP_V = -10;
const PLAYER_X = 30;
const PLAYER_W = 20;
const PLAYER_H = 20;

const STORAGE_KEY = "embergo.game.high";

type Obstacle = { x: number; w: number; h: number };

type GameState = {
  running: boolean;
  over: boolean;
  playerY: number;
  vy: number;
  obstacles: Obstacle[];
  speed: number;
  score: number;
  spawnCountdown: number;
  rafId: number;
};

function initialState(): GameState {
  return {
    running: false,
    over: false,
    playerY: GROUND_Y - PLAYER_H,
    vy: 0,
    obstacles: [],
    speed: 4,
    score: 0,
    spawnCountdown: 60,
    rafId: 0,
  };
}

export function DinoRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initialState());
  const bestRef = useRef(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");

  // Read high score on mount.
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

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = fg;
    ctx.fillRect(0, GROUND_Y, WIDTH, 1);
    ctx.fillRect(PLAYER_X, s.playerY, PLAYER_W, PLAYER_H);
    for (const o of s.obstacles) {
      ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
    }

    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = fg;
    ctx.fillText(
      String(Math.floor(s.score)).padStart(5, "0"),
      WIDTH - 8,
      18,
    );
    if (bestRef.current > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = dim;
      ctx.fillText(
        `HI ${String(bestRef.current).padStart(5, "0")}`,
        8,
        18,
      );
    }

    if (s.over) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 16px ui-sans-serif, system-ui";
      ctx.fillText("Game over · tap to retry", WIDTH / 2, HEIGHT / 2);
    } else if (!s.running) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 16px ui-sans-serif, system-ui";
      ctx.fillText("Tap or press space", WIDTH / 2, HEIGHT / 2);
    }
  }, []);

  const loop = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;

    s.vy += GRAVITY;
    s.playerY += s.vy;
    if (s.playerY > GROUND_Y - PLAYER_H) {
      s.playerY = GROUND_Y - PLAYER_H;
      s.vy = 0;
    }

    s.spawnCountdown -= 1;
    if (s.spawnCountdown <= 0) {
      const h = 18 + Math.floor(Math.random() * 14);
      const w = 14 + Math.floor(Math.random() * 6);
      s.obstacles.push({ x: WIDTH, w, h });
      s.spawnCountdown =
        Math.max(38, 110 - Math.floor(s.speed * 5)) +
        Math.floor(Math.random() * 40);
    }
    for (const o of s.obstacles) o.x -= s.speed;
    s.obstacles = s.obstacles.filter((o) => o.x + o.w > 0);

    s.speed += 0.001;
    s.score += s.speed;

    for (const o of s.obstacles) {
      const oy = GROUND_Y - o.h;
      if (
        PLAYER_X < o.x + o.w &&
        PLAYER_X + PLAYER_W > o.x &&
        s.playerY < oy + o.h &&
        s.playerY + PLAYER_H > oy
      ) {
        s.over = true;
        s.running = false;
        const final = Math.floor(s.score);
        if (final > bestRef.current) {
          bestRef.current = final;
          localStorage.setItem(STORAGE_KEY, String(final));
          setBest(final);
        }
        setPhase("over");
        draw();
        return;
      }
    }

    draw();
    s.rafId = requestAnimationFrame(loop);
  }, [draw]);

  const start = useCallback(() => {
    stateRef.current = { ...initialState(), running: true };
    setPhase("playing");
    loop();
  }, [loop]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.over || !s.running) {
      start();
      return;
    }
    if (s.playerY >= GROUND_Y - PLAYER_H - 0.5) {
      s.vy = JUMP_V;
    }
  }, [start]);

  // Initial idle draw + global cleanup.
  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, [draw]);

  // Keyboard input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

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
          jump();
        }}
      />
      <p className="text-xs text-neutral-500">
        Tap or press{" "}
        <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">
          space
        </kbd>{" "}
        to jump.
        {best > 0 && (
          <>
            {" "}
            Best: <strong>{best}</strong>
          </>
        )}
        {phase === "playing" && " · Stay alive."}
      </p>
    </div>
  );
}
