import type { MetadataRoute } from "next";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { SITE_URL, portfolioCaseStudyPath } from "@/lib/seo";

const STATIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/portfolio", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/brief", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/book", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/suite", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.35, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.35, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const portfolioEntries: MetadataRoute.Sitemap = portfolioPublicStudies.map((study) => ({
    url: `${SITE_URL}${portfolioCaseStudyPath(study.id)}`,
    lastModified: study.review?.reviewedAt
      ? new Date(study.review.reviewedAt)
      : new Date(`${study.year}-01-01T00:00:00.000Z`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...portfolioEntries];
}
