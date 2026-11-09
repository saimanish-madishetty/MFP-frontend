import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mahadeva.foodproducts",
  appName: "Mahadeva Foods",
  webDir: "out",
  // The app opens the live website, so a deploy reaches the phone without a new APK. Only phone-level
  // changes (widgets, icon, permissions, plugins) need one. `out/` is still packed for offline.html,
  // shown when the website can't be reached. CAP_LOCAL=1 builds an APK with the packed screens instead.
  server: process.env.CAP_LOCAL
    ? undefined
    : { url: "https://mfp-frontend-omega.vercel.app", errorPath: "offline.html" },
  plugins: {
    SystemBars: {
      // Android 15+ draws the app edge-to-edge; this exposes --safe-area-inset-* CSS variables for padding.
      insetsHandling: "css",
    },
  },
};

export default config;
