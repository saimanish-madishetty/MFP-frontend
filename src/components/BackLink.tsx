"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasInAppHistory } from "@/lib/back-stack";

/** "← Back": returns to the previous page like the phone's back button; falls back to `href`. */
export function BackLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      replace
      onClick={(e) => {
        if (hasInAppHistory()) {
          e.preventDefault();
          router.back();
        }
      }}
      className="mb-1 inline-block text-sm text-muted hover:text-foreground"
    >
      ← Back
    </Link>
  );
}
