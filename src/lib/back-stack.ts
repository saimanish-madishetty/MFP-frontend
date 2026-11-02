"use client";

import { useEffect, useRef } from "react";

// Open overlays (sheets, the side menu) register here so the phone's back button closes the
// top-most one instead of leaving the page.
const stack: { id: number; close: () => void }[] = [];
let nextId = 1;

/** Closes the top-most open overlay. Returns false if none is open. */
export function closeTopOverlay(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.close();
  return true;
}

/** While `open`, the back button calls `onClose` instead of navigating. */
export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const entry = { id: nextId++, close: () => closeRef.current() };
    stack.push(entry);
    return () => {
      const i = stack.findIndex((e) => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

// Number of in-app page views since the app opened (1 = the first page).
let pageViews = 0;

export function countPageView() {
  pageViews += 1;
}

/** True when there is an earlier in-app page to go back to. */
export function hasInAppHistory() {
  return pageViews > 1;
}
