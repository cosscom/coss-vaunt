import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@coss/vaunt-engine", "@coss/ui"],
};

export default nextConfig;
