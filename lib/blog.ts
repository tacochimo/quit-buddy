import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // YYYY-MM-DD
  html: string;
  readingMinutes: number;
};

const POSTS_DIR = path.join(process.cwd(), "content/blog");

function readMarkdownFiles(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
}

export function getPostSlugs(): string[] {
  return readMarkdownFiles().map((f) => f.replace(/\.md$/, ""));
}

export function loadPost(slug: string): Post | null {
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const html = marked.parse(parsed.content, { async: false }) as string;
  const words = parsed.content.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 220));
  return {
    slug,
    title: (parsed.data.title as string) ?? slug,
    description: (parsed.data.description as string) ?? "",
    publishedAt: (parsed.data.publishedAt as string) ?? "",
    html,
    readingMinutes,
  };
}

export function getAllPosts(): Post[] {
  return getPostSlugs()
    .map((slug) => loadPost(slug))
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
