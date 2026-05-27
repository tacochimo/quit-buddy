import Link from "next/link";
import { SliceBoard } from "./board";

export default function SlicePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Slice</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Swipe through the fruit. Miss too many — or hit a bomb — and you&apos;re out.
          60 seconds.
        </p>
      </header>

      <SliceBoard />

      <p className="text-center text-xs text-neutral-500">
        Drag across the canvas to slice. Combo bonuses for slicing multiple in one swipe.
      </p>

      <p className="text-center text-xs text-neutral-500">
        <Link
          href="/app/game"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ← Runner
        </Link>
        {" · "}
        <Link
          href="/app/snake"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Snake
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
