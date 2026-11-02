"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { closeTopOverlay, countPageView } from "@/lib/back-stack";

/**
 * Android back button (app only):
 * 1. close an open sheet / the side menu,
 * 2. otherwise go to the previous page,
 * 3. with no history, go to the dashboard,
 * 4. on the dashboard with no history, exit the app.
 */
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
    countPageView();
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (closeTopOverlay()) return;
        if (canGoBack) window.history.back();
        else if (pathRef.current !== "/") router.replace("/");
        else App.exitApp();
      });
      if (cancelled) handle.remove();
      else remove = () => handle.remove();
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
