import Link from "next/link";
import { BreatheExercise } from "./exercise";

export default function BreathePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Box breathing</h1>
        <p className="mt-2 text-sm text-neutral-500">
          A craving usually peaks in under 5 minutes. Breathe through it.
        </p>
      </header>

      <BreatheExercise />

      <p className="text-center text-xs text-neutral-500">
        4 seconds in · 4 hold · 4 out · 4 hold. Used by Navy SEALs to stay calm
        under pressure.
      </p>
    </main>
  );
}
