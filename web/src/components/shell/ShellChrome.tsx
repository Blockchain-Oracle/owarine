"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BootNotice } from "@/providers/MarketsBoot";
import CustomCursor from "./CustomCursor";
import { AppRail } from "./app/AppRail";
import { useNavKeys } from "./app/keys";
import { MoreSheet } from "./app/MoreSheet";
import { PhoneDock } from "./app/PhoneDock";
import { ShellOverlays } from "./app/ShellOverlays";
import { TopBar } from "./app/TopBar";
import { isTradeRoute } from "./nav";

/**
 * The app shell (Stage B, Slush by way of roy-chain's `app-shell.tsx`): the floating rail on the left, the slim top bar,
 * and ONE rounded stage that holds the page; on phones the top bar carries the seal, mode, money and seat, and the dock
 * sits at the bottom. Every route has it except the landing, which paints its own sky, nav and footer edge to edge.
 */
export function ShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return <AppShell trade={isTradeRoute(pathname)}>{children}</AppShell>;
}

function AppShell({ trade, children }: { trade: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  useNavKeys();
  useShellMark(trade);
  return (
    <>
      <AppRail onMore={() => setMore(true)} moreOpen={more} />
      <div
        className={cn(
          "flex min-h-dvh min-w-0 flex-col md:pr-(--rail-inset) md:pb-(--rail-inset) md:pl-[calc(var(--rail-w-collapsed)+var(--rail-inset)*2)] xl:pl-[calc(var(--rail-w)+var(--rail-inset)*2)]",
          // Phones: the trading screen runs edge to edge above the dock; every other page sits in a gutter.
          trade ? "h-dvh pb-[calc(var(--dock-h)+env(safe-area-inset-bottom,0rem))] md:h-dvh" : "px-3 pb-[calc(var(--dock-h)+env(safe-area-inset-bottom,0rem)+0.75rem)]",
        )}
      >
        <TopBar className={cn(trade ? "max-md:hidden" : "max-md:sticky max-md:top-0 max-md:z-30 max-md:-mx-3 max-md:bg-ow-canvas/90 max-md:px-3 max-md:backdrop-blur-md")} />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "page-shell ow-stage relative min-w-0 flex-1 bg-ow-stage text-ow-ink outline-none",
            trade ? "flex min-h-0 flex-col overflow-hidden md:rounded-ow-sheet" : "overflow-clip rounded-ow-sheet",
          )}
        >
          <BootNotice />
          {children}
        </main>
      </div>
      <PhoneDock onMore={() => setMore(true)} moreOpen={more} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
      <ShellOverlays />
      <CustomCursor />
    </>
  );
}

/** Marks the document while the shell is mounted, and whether the trading screen owns the viewport (shell.css). */
function useShellMark(trade: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.shell = trade ? "trade" : "app";
    return () => {
      delete root.dataset.shell;
    };
  }, [trade]);
}
