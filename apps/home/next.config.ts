import path from "node:path";
import type { NextConfig } from "next";

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
              "style-src 'self' 'unsafe-inline' https://calendar.google.com https://fonts.googleapis.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://calendar.google.com https://static.cloudflareinsights.com",
              "connect-src 'self' https: http://10.0.0.21:8899 http://10.0.0.57:8080 https://api.stripe.com",
              "frame-src 'self' https://calendar.google.com https://js.stripe.com https://hooks.stripe.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
