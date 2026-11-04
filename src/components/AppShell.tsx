"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useBackClose } from "@/lib/back-stack";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/lib/use-auth";
import { AccountPanel } from "./Account";
import { Badge } from "./ui";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto p-3">
      {navItems.filter((item) => isAdmin || !item.adminOnly).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
        const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium";

        if (!item.ready) {
          return (
            <span key={item.href} className={`${base} cursor-not-allowed text-muted/60`}>
              <Icon path={item.icon} />
              {item.label}
              <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`${base} ${active ? "bg-brand text-brand-fg" : "text-foreground hover:bg-surface-2"}`}
          >
            <Icon path={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <Image src="/mahadeva_icon.jpeg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Mahadeva Foods</p>
        <p className="text-xs text-muted">Stock &amp; Sales</p>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { canEdit } = useAuth();
  useBackClose(drawerOpen, () => setDrawerOpen(false));

  return (
    <div className="flex min-h-dvh pl-safe-left pr-safe-right">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="border-b border-border px-4 py-4">
          <Brand />
        </div>
        <NavLinks />
        <AccountPanel />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface pt-safe-top shadow-xl">
            <div className="border-b border-border px-4 py-4">
              <Brand />
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            <AccountPanel />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface pt-safe-top">
          <div className="flex h-14 items-center gap-3 px-4">
            <button
              aria-label="Open menu"
              className="-ml-2 rounded-lg p-2 hover:bg-surface-2 md:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Icon path="M4 6h16M4 12h16M4 18h16" />
            </button>
            <div className="md:hidden">
              <Brand />
            </div>
            {!canEdit && (
              <span className="ml-auto">
                <Badge>View only</Badge>
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 pb-safe-bottom md:p-6">{children}</main>
      </div>
    </div>
  );
}
