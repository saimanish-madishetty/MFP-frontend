"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/api";
import { watchSystemTheme } from "@/lib/theme";
import BackButton from "./BackButton";

export default function Providers({ children }: { children: React.ReactNode }) {
  // "Same as phone" theme: follow the phone switching between light and dark while the app is open.
  useEffect(() => watchSystemTheme(), []);
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true }}>
      <BackButton />
      {children}
    </SWRConfig>
  );
}
