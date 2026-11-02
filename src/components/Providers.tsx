"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/api";
import BackButton from "./BackButton";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true }}>
      <BackButton />
      {children}
    </SWRConfig>
  );
}
