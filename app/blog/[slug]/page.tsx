import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostSlugs, loadPost } from "@/lib/blog";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) return { title: "Not found — Quit Buddy" };
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return {
    title: `${post.title} — Quit Buddy`,
    description: post.description,
    alternates: { canonical: `${siteUrl}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `${siteUrl}/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <header>
        <Link
          href="/blog"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Articles
        </Link>
        <p className="mt-3 text-xs text-neutral-500">
          {post.publishedAt} · {post.readingMinutes} min read
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {post.description && (
          <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
            {post.description}
          </p>
        )}
      </header>

      <article
        className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-emerald-700 dark:prose-a:text-emerald-400"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      <hr className="border-neutral-200 dark:border-neutral-800" />

      <section className="rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/30">
        <p className="text-lg font-semibold">Quitting now?</p>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          Quit Buddy is built around a small private channel of 1-3 people who
          actually know you — plus a coach who knows your patterns. Free, no
          ads.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
        >
          Try Quit Buddy
        </Link>
      </section>
    </main>
  );
}
