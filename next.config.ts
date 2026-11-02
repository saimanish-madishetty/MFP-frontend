import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the same `out/` folder is deployed to Vercel and bundled into the Android APK by Capacitor.
  output: "export",
  // Capacitor serves files from disk, so `/stock` must resolve to `/stock/index.html`.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
