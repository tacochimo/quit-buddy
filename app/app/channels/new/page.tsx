import Link from "next/link";
import { CreateChannelForm } from "./form";

export default function NewChannelPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href="/app/home"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create a channel</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Invite people you trust. You&apos;ll all see each other&apos;s
          progress and rank on the leaderboard.
        </p>
      </header>

      <CreateChannelForm />
    </main>
  );
}
