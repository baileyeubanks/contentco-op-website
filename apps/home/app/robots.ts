import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/portfolio", "/portfolio/", "/brief", "/book", "/suite", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/brandcenter",
          "/brandcentral",
          "/root/",
          "/dashboard/",
          "/client/",
          "/share/",
          "/portal/",
        ],
      },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
