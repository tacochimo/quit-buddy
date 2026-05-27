import Link from "next/link";
import { SnakeBoard } from "./board";

export default function SnakePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Snake</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Eat the dot. Don&apos;t bite yourself. Don&apos;t hit the wall.
        </p>
      </header>

      <SnakeBoard />

      <p className="text-center text-xs text-neutral-500">
        Swipe, tap a D-pad arrow, or use the arrow / WASD keys.
      </p>

      <p className="text-center text-xs text-neutral-500">
        <Link
          href="/app/game"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Runner
        </Link>
        {" · "}
        <Link
          href="/app/slice"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Slice
        </Link>
        {" · "}
        <Link
          href="/app/flap"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Flight
        </Link>
      </p>
    </main>
  );
}
