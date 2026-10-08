"use client";

import { TICKERS } from "@owarine/core/market";
import { useLanes } from "@owarine/markets/react";
import { CalendarClock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useVenue } from "@/features/markets/useVenue";
import { cn } from "@/lib/utils";
import { MORE, PLACES } from "../nav";
import { typing } from "./keys";

/** Opens the palette from anywhere (the More sheet's search field on a phone, where there is no ⌘K). */
export const OPEN_SEARCH_EVENT = "owarine:open-search";

/** The markets ⌘K offers: every asset with a price Window still to trade, and the live events, from the board. */
function useBoardEntries(open: boolean) {
  const venue = useVenue();
  // Read only while the palette is open; the board's own query is shared, so this is a cache hit almost always.
  const reading = useLanes(open ? venue.venueId : null);
  return useMemo(() => {
    const set = reading && reading.ok ? reading.value : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const assets = new Set<string>();
    for (const lane of set?.lanes ?? []) {
      for (const m of lane.markets) if (m.kind !== "event" && !m.voided && m.expirySec > nowSec && m.asset in TICKERS) assets.add(m.asset);
    }
    const events = (set?.events ?? []).filter((e) => !e.voided && e.expirySec > nowSec).slice(0, 12);
    return { assets: [...assets].sort(), events };
  }, [reading]);
}

/**
 * ⌘K or `/`: every place, every market on the board and every page, one keystroke away (roy-chain's
 * `command-palette.client.tsx`). The board only loads once it is opened.
 */
export function CommandPalette({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const board = useBoardEntries(open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const openFromEvent = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, openFromEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, openFromEvent);
    };
  }, []);

  const go = (href: string, external?: boolean) => {
    setOpen(false);
    if (external) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K /"
        aria-label="Search markets and pages"
        className={cn(
          "flex h-10 items-center gap-2 rounded-full bg-ow-card px-3.5 text-ow-muted ring-1 ring-ow-hairline outline-none transition-colors hover:text-ow-ink focus-visible:ring-2 focus-visible:ring-ow-pink-ink md:w-72",
          className,
        )}
      >
        <Search aria-hidden className="size-4.5 shrink-0" strokeWidth={2.5} />
        <span className="hidden text-ow-label md:inline">Search markets and pages</span>
        <kbd className="ml-auto hidden rounded-md bg-ow-recessed px-1.5 py-0.5 font-sans text-ow-micro font-semibold text-ow-muted md:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Go to" description="Jump to any market or page in Owarine">
        <Command loop>
          <CommandInput placeholder="Where to? BTC, Tesla, Leaderboard…" autoFocus />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Go to">
              {PLACES.map((item) => (
                <CommandItem key={item.id} value={item.name} keywords={[item.description]} onSelect={() => go(item.href)}>
                  <item.icon aria-hidden />
                  <span>{item.name}</span>
                  <CommandShortcut>{item.digit}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {board.assets.length > 0 ? (
              <CommandGroup heading="Trade">
                {board.assets.map((asset) => {
                  const name = TICKERS[asset as keyof typeof TICKERS]?.name ?? asset;
                  return (
                    <CommandItem key={asset} value={name} keywords={[asset, "trade"]} onSelect={() => go(`/trade/${asset}`)}>
                      <AssetDisc asset={asset} className="ow-disc-24" />
                      <span className="truncate">{name}</span>
                      <CommandShortcut className="ow-axis">{asset}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {board.events.length > 0 ? (
              <CommandGroup heading="Events">
                {board.events.map((e) => (
                  <CommandItem key={e.marketId} value={`${e.question} ${e.marketId}`} keywords={["event"]} onSelect={() => go(`/markets/${e.marketId}`)}>
                    <CalendarClock aria-hidden />
                    <span className="line-clamp-1">{e.question}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {MORE.map((section) => (
              <CommandGroup key={section.id} heading={section.name}>
                {section.items.map((item) => (
                  <CommandItem key={item.id} value={item.name} keywords={[item.description]} onSelect={() => go(item.href, item.external)}>
                    <item.icon aria-hidden />
                    <span>{item.name}</span>
                    <CommandShortcut className="max-sm:hidden">{item.description}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
