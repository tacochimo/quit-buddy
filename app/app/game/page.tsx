import Link from "next/link";
import { DinoRunner } from "./runner";

export default function GamePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Quick game</h1>
        <p className="mt-2 text-sm text-neutral-500">
          A craving usually peaks in under 5 minutes. Play through it.
        </p>
      </header>

      <DinoRunner />

      <p className="text-center text-xs text-neutral-500">
        Tap to jump. Don&apos;t hit anything. That&apos;s the whole game.
      </p>
    </main>
  );
}
