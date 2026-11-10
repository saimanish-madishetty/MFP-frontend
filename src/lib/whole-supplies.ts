"use client";

import { useState } from "react";

const KEY = "mfp.wholeSupplies";

/** Recipe amounts of a supply rounded down to a whole number (covers, boxes can't be fractions). */
export const floorWhole = (n: number) => Math.floor(n + 1e-9);

/**
 * "Whole numbers only" for supplies: on by default, remembered on this device.
 * While on, the recipe amounts of supplies are rounded down.
 */
export function useWholeSupplies(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(KEY) !== "0";
    } catch {
      return true;
    }
  });
  const set = (v: boolean) => {
    setOn(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // Not remembered; fine.
    }
  };
  return [on, set];
}
