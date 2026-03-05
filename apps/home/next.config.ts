import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  transpilePackages: ["@contentco-op/ui", "@contentco-op/brand", "@contentco-op/types"]
};

export default nextConfig;
