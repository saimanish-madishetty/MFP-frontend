"use client";

import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const COMMIT = process.env.NEXT_PUBLIC_COMMIT;
const noSubscribe = () => () => {};

/** "App 1.6 · 2b7f8cd" (in the Android app) or "Web 1.6 · 2b7f8cd", just above the account panel. */
export function AppVersion() {
  // The page is built once and served to both the app and the website, so this is decided in the browser.
  const where = useSyncExternalStore(
    noSubscribe,
    () => (Capacitor.isNativePlatform() ? "App" : "Web"),
    () => "Version",
  );
  if (!VERSION) return null;
  return (
    <p className="px-4 pb-1 text-right text-[11px] text-muted tabular-nums" title="Version of this app">
      {where} {VERSION}
      {COMMIT && ` · ${COMMIT}`}
    </p>
  );
}
