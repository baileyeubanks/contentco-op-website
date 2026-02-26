import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@contentco-op/brand", "@contentco-op/types", "@contentco-op/ui"]
};

export default nextConfig;

