import path from "node:path";
import type { NextConfig } from "next";

const VERSIONED_MEDIA_CACHE = "public, max-age=31536000, immutable";
const EDGE_STATIC_CACHE = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: false, qualities: [75, 82, 85] },
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@contentco-op/ui", "@contentco-op/brand", "@contentco-op/types", "@contentco-op/identity-access", "@contentco-op/pricing"],
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: VERSIONED_MEDIA_CACHE }],
      },
      {
        source: "/cc/video/:path*",
        headers: [{ key: "Cache-Control", value: VERSIONED_MEDIA_CACHE }],
      },
      {
        source: "/cc/photos/:path*",
        headers: [{ key: "Cache-Control", value: EDGE_STATIC_CACHE }],
      },
      {
        source: "/cc/portfolio-cdn/:path*",
        headers: [{ key: "Cache-Control", value: EDGE_STATIC_CACHE }],
      },
      {
        source: "/cc/logos/:path*",
        headers: [{ key: "Cache-Control", value: EDGE_STATIC_CACHE }],
      },
      {
        source: "/logos/:path*",
        headers: [{ key: "Cache-Control", value: EDGE_STATIC_CACHE }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: EDGE_STATIC_CACHE }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "autoplay=(self), camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline' https://calendar.google.com https://fonts.googleapis.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://calendar.google.com https://static.cloudflareinsights.com",
              "connect-src 'self' https:",
              "frame-src 'self' https://calendar.google.com https://js.stripe.com https://hooks.stripe.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/root/co-cut/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
// deploy 1773882332
