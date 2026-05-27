"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 20;
const ROWS = 12;
const CELL = 16;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

const TICK_START_MS = 125; // 8 cells/sec
const TICK_MIN_MS = 70; // ~14 cells/sec
const TICK_STEP_MS = 4; // ~0.2 cells/sec speed-up per pellet

const STORAGE_KEY = "quitbuddy.snake.high";

type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type State = {
  snake: Cell[];
  dir: Dir;
  pendingDir: Dir;
  food: Cell;
  score: number;
  tickMs: number;
  running: boolean;
  over: boolean;
  timerId: number;
};

function randomFood(snake: Cell[]): Cell {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  // Pick from empty cells uniformly.
  const empty: Cell[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return { x: 0, y: 0 };
  return empty[Math.floor(Math.random() * empty.length)];
}

function initialState(): State {
  const mid = Math.floor(ROWS / 2);
  const snake: Cell[] = [
    { x: 5, y: mid },
    { x: 4, y: mid },
    { x: 3, y: mid },
  ];
  return {
    snake,
    dir: "right",
    pendingDir: "right",
    food: randomFood(snake),
    score: 0,
    tickMs: TICK_START_MS,
    running: false,
    over: false,
    timerId: 0,
  };
}

export function SnakeBoard() {
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
    const isDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const bg = isDark ? "#0a0a0a" : "#fafafa";
    const fg = isDark ? "#f5f5f5" : "#171717";
    const accent = "#10b981";
    const dim = isDark ? "#525252" : "#a3a3a3";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Food
    ctx.fillStyle = accent;
    ctx.fillRect(
      s.food.x * CELL + 2,
      s.food.y * CELL + 2,
      CELL - 4,
      CELL - 4,
    );

    // Snake
    ctx.fillStyle = fg;
    for (const c of s.snake) {
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // Score
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = fg;
    ctx.fillText(String(s.score).padStart(3, "0"), WIDTH - 6, 14);
    if (bestRef.current > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = dim;
      ctx.fillText(`HI ${String(bestRef.current).padStart(3, "0")}`, 6, 14);
    }

    if (s.over) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 14px ui-sans-serif, system-ui";
      ctx.fillText("Game over · tap to retry", WIDTH / 2, HEIGHT / 2);
    } else if (!s.running) {
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = "bold 14px ui-sans-serif, system-ui";
      ctx.fillText("Tap or press space", WIDTH / 2, HEIGHT / 2);
    }
  }, []);

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.dir = s.pendingDir;
    const head = s.snake[0];
    const d = DELTA[s.dir];
    const next: Cell = { x: head.x + d.x, y: head.y + d.y };

    // Wall collision
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      s.over = true;
      s.running = false;
      if (s.score > bestRef.current) {
        bestRef.current = s.score;
        localStorage.setItem(STORAGE_KEY, String(s.score));
        setBest(s.score);
      }
      setPhase("over");
      draw();
      return;
    }

    // Self collision — check against all but the tail (which will move).
    const willEat = next.x === s.food.x && next.y === s.food.y;
    const bodyToCheck = willEat ? s.snake : s.snake.slice(0, -1);
    for (const c of bodyToCheck) {
      if (c.x === next.x && c.y === next.y) {
        s.over = true;
        s.running = false;
        if (s.score > bestRef.current) {
          bestRef.current = s.score;
          localStorage.setItem(STORAGE_KEY, String(s.score));
          setBest(s.score);
        }
        setPhase("over");
        draw();
        return;
      }
    }

    s.snake.unshift(next);
    if (willEat) {
      s.score += 1;
      s.food = randomFood(s.snake);
      s.tickMs = Math.max(TICK_MIN_MS, s.tickMs - TICK_STEP_MS);
      window.clearInterval(s.timerId);
      s.timerId = window.setInterval(tick, s.tickMs);
    } else {
      s.snake.pop();
    }

    draw();
  }, [draw]);

  const start = useCallback(() => {
    const s = stateRef.current;
    window.clearInterval(s.timerId);
    stateRef.current = { ...initialState(), running: true };
    stateRef.current.timerId = window.setInterval(
      tick,
      stateRef.current.tickMs,
    );
    setPhase("playing");
    draw();
  }, [draw, tick]);

  const setDirection = useCallback(
    (d: Dir) => {
      const s = stateRef.current;
      if (s.over || !s.running) {
        start();
        // Apply the requested direction to the new game, unless it would
        // immediately reverse the default rightward start.
        if (d !== OPPOSITE[stateRef.current.dir]) {
          stateRef.current.pendingDir = d;
        }
        return;
      }
      if (d === OPPOSITE[s.dir]) return;
      s.pendingDir = d;
    },
    [start],
  );

  // Initial draw + cleanup.
  useEffect(() => {
    draw();
    return () => window.clearInterval(stateRef.current.timerId);
  }, [draw]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Dir | "start"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        KeyW: "up",
        KeyS: "down",
        KeyA: "left",
        KeyD: "right",
        Space: "start",
      };
      const action = map[e.code];
      if (!action) return;
      e.preventDefault();
      if (action === "start") {
        const s = stateRef.current;
        if (!s.running || s.over) start();
        return;
      }
      setDirection(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDirection, start]);

  // Swipe
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const threshold = 20;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      // Treat as tap → start/restart only.
      const s = stateRef.current;
      if (!s.running || s.over) {
        setDirection("right");
      }
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? "right" : "left");
    } else {
      setDirection(dy > 0 ? "down" : "up");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full max-w-md cursor-pointer touch-none rounded-2xl border border-neutral-200 dark:border-neutral-800"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />

      <div className="grid w-40 grid-cols-3 grid-rows-2 gap-1">
        <div />
        <DPadButton label="▲" onClick={() => setDirection("up")} />
        <div />
        <DPadButton label="◀" onClick={() => setDirection("left")} />
        <DPadButton label="▼" onClick={() => setDirection("down")} />
        <DPadButton label="▶" onClick={() => setDirection("right")} />
      </div>

      <p className="text-xs text-neutral-500">
        {best > 0 && (
          <>
            Best: <strong>{best}</strong>
          </>
        )}
        {phase === "playing" && (best > 0 ? " · " : "") + "Eat the dot."}
      </p>
    </div>
  );
}

function DPadButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex h-12 items-center justify-center rounded-lg border border-neutral-300 text-lg font-bold text-neutral-700 transition active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300 dark:active:bg-neutral-800"
      aria-label={label}
    >
      {label}
    </button>
  );
}
