import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contentco-op/brand", "@contentco-op/types", "@contentco-op/ui"]
};

export default nextConfig;

