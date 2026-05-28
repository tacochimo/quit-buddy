import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const url = baseUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${url}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const posts = getAllPosts().map((p) => ({
    url: `${url}/blog/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...posts];
}
