import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@calcom/ai", "@calcom/product-video", "@coss/ui"],
};

export default nextConfig;
