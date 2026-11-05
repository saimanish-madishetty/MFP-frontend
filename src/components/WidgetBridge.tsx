"use client";

import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshWidgets, syncWidgetLogin, widgetPath } from "@/lib/widgets";

/**
 * Android only: keeps the home-screen widgets logged in as this user, refreshes them when the app
 * goes to the background, and opens the page a widget was tapped for. Renders nothing.
 */
export function WidgetBridge({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => syncWidgetLogin(token), [token]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const open = (url?: string) => {
      const path = url && widgetPath(url);
      if (path) router.push(path);
    };
    (async () => {
      const { App } = await import("@capacitor/app");
      if (cancelled) return;
      handles.push(await App.addListener("pause", refreshWidgets));
      handles.push(await App.addListener("appUrlOpen", (e) => open(e.url)));
      // Opened from a widget while the app wasn't running.
      open((await App.getLaunchUrl())?.url);
    })();
    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, [router]);

  return null;
}
