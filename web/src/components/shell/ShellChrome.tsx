"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BootNotice } from "@/providers/MarketsBoot";
import CustomCursor from "./CustomCursor";
import Footer from "./Footer";
import { AppRail } from "./app/AppRail";
import { PhoneChrome } from "./app/PhoneChrome";
import { ShellOverlays } from "./app/ShellOverlays";
import { MobileBottomNav } from "./header/MobileBottomNav";

/**
 * Routes the reference renders WITHOUT the app's ticker, header and footer — each of those pages
 * mounts its own chrome (`app/trade-from-x/page.tsx` imports no `Header`/`Marquee`; its sticky
 * strip carries the primary nav instead). Every other route gets the shared shell.
 */
export const ISLAND_ROUTES: readonly string[] = ["/trade-from-x", "/trade"];

export function isIslandRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ISLAND_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** The shell, or none of it: islands paint their own edges, so the shell must not paint over them. */
export function ShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The trading screen draws its own nav, rail and dock (TRADASH-FIDELITY.md): no shell at all.
  if (pathname === "/trade" || pathname?.startsWith("/trade/")) return <>{children}</>;
  // The landing paints its own sky, nav and footer edge to edge (revamp step 3).
  if (pathname === "/") return <>{children}</>;
  if (isIslandRoute(pathname)) {
    return (
      <>
        <CustomCursor />
        <main className="page-island">
          <BootNotice />
          {children}
        </main>
        <MobileBottomNav />
      </>
    );
  }
  return (
    <>
      <ShellMark />
      <AppRail />
      <PhoneChrome />
      <ShellOverlays />
      <CustomCursor />
      <main className="page-shell">
        <BootNotice />
        {children}
      </main>
      <Footer />
    </>
  );
}

/** Marks the document while the revamp shell is mounted (shell.css swaps the old header offsets for the rail's). */
function ShellMark() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.shell = "app";
    return () => {
      delete root.dataset.shell;
    };
  }, []);
  return null;
}
