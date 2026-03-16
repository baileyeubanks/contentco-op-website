import type { NextConfig } from "next";

const blazeApiUrl = process.env.BLAZE_API_URL ?? "";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    unoptimized: true,
    qualities: [75, 82, 85],
  },
  transpilePackages: ["@contentco-op/ui", "@contentco-op/brand", "@contentco-op/types"],
  expireTime: 60,
  async headers() {
    const connectSrcExtra = blazeApiUrl ? ` ${blazeApiUrl}` : "";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline' https://calendar.google.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://calendar.google.com",
              `connect-src 'self' https:${connectSrcExtra}`,
              "frame-src 'self' https://calendar.google.com",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
