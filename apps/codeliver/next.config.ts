import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contentco-op/ui", "@contentco-op/brand", "@contentco-op/types"]
};

export default nextConfig;
