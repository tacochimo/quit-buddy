import Link from "next/link";
import { FlapBird } from "./bird";

export default function FlapPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Smoke-free flight</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tap to flap your lungs. Dodge the cigarettes. Every pipe cleared is
          one more smoke-free day.
        </p>
      </header>

      <FlapBird />

      <p className="text-center text-xs text-neutral-500">
        Tap the canvas or press space.
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
          href="/app/snake"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Snake
        </Link>
        {" · "}
        <Link
          href="/app/slice"
          className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Slice
        </Link>
      </p>
    </main>
  );
}
