import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Articles — Quit Buddy",
  description:
    "Practical writing about quitting smoking, withdrawal, cravings, and the science of cessation.",
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <header>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Quit Buddy
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Articles
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Practical writing about quitting smoking, withdrawal, and what to do
          at 3am on day 3.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-neutral-500">No posts yet.</p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group block">
                <p className="text-xs text-neutral-500">
                  {p.publishedAt} · {p.readingMinutes} min read
                </p>
                <h2 className="mt-1 text-xl font-semibold transition group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {p.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
