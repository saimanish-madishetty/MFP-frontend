import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/** The app version (versionName in the Android build) and commit, shown at the bottom of the menu. */
function buildInfo() {
  let version = "";
  try {
    version = /versionNames+"([^"]+)"/.exec(readFileSync("android/app/build.gradle", "utf8"))?.[1] ?? "";
  } catch {}
  let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!commit) {
    try {
      commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {}
  }
  return { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_COMMIT: commit.slice(0, 7) };
}

const nextConfig: NextConfig = {
  // Static export: the same `out/` folder is deployed to Vercel and bundled into the Android APK by Capacitor.
  output: "export",
  env: buildInfo(),
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
