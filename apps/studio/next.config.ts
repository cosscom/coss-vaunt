import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@coss/vaunt-engine", "@coss/ui"],
  // The `vaunt` package's build sets this to ship a self-contained server; see packages/vaunt/scripts/build.ts.
  ...(process.env.VAUNT_STANDALONE
    ? {
        output: "standalone",
        distDir: ".next-vaunt",
        outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
      }
    : {}),
};

export default nextConfig;
