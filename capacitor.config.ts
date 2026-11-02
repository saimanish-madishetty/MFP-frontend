import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mahadeva.foodproducts",
  appName: "Mahadeva Foods",
  webDir: "out",
  plugins: {
    SystemBars: {
      // Android 15+ draws the app edge-to-edge; this exposes --safe-area-inset-* CSS variables for padding.
      insetsHandling: "css",
    },
  },
};

export default config;
