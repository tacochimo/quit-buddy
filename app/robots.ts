import type { MetadataRoute } from "next";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/login", "/share"],
        // Authenticated app surfaces and API routes shouldn't be crawled.
        disallow: ["/app/", "/api/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
