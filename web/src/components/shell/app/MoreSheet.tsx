"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Sheet } from "@/components/kit";
import { CANTON_ATTRIBUTION } from "@/features/landing/sponsors";
import { cn } from "@/lib/utils";
import { DOCK, MORE, PLACES, type NavItem } from "../nav";
import { OPEN_SEARCH_EVENT } from "./CommandPalette";

/** Where the prices come from, in one line (it rode the old footer on every page). */
const CREDIT = "Prices are signed by the venue's oracle parties from Coinbase, Kraken, Bitstamp, RedStone, Alpaca, Jupiter Price v3 and PreStocks data. Every print is checkable on Print proof.";

/** The places the phone dock has no room for; the rail lists all six from md up. */
const UNDOCKED = PLACES.filter((p) => ![...DOCK.left, ...DOCK.right].some((d) => d.id === p.id));

function Tile({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex items-start gap-3 rounded-ow-card bg-ow-recessed/60 p-3 outline-none transition-colors hover:bg-ow-recessed focus-visible:ring-2 focus-visible:ring-ow-pink-ink"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-card">
        <item.icon aria-hidden className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-ow-label font-bold">{item.name}</span>
        <span className="line-clamp-2 block text-ow-caption text-ow-muted">{item.description}</span>
      </span>
    </Link>
  );
}

/** More: search, every page that is not a place (grouped), and the small print the footer used to carry. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="More" size="lg">
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
          }}
          className="flex h-12 items-center gap-2.5 rounded-full bg-ow-recessed px-4 text-ow-body text-ow-muted outline-none hover:text-ow-ink focus-visible:ring-2 focus-visible:ring-ow-pink-ink"
        >
          <Search aria-hidden className="size-4.5" strokeWidth={2.5} />
          Search markets and pages
        </button>
        <nav aria-label="Places" className="grid grid-cols-3 gap-2 md:hidden">
          {UNDOCKED.map((item) => (
            <Link key={item.id} href={item.href} onClick={onClose} className="flex flex-col items-center gap-1.5 rounded-ow-card bg-ow-black py-3.5 text-ow-white outline-none focus-visible:ring-2 focus-visible:ring-ow-pink-ink">
              <item.icon aria-hidden className="size-5.5" />
              <span className="text-ow-label font-bold">{item.name}</span>
            </Link>
          ))}
        </nav>
        {MORE.map((section) => (
          <section key={section.id} aria-labelledby={`more-${section.id}`} className="flex flex-col gap-2">
            <h2 id={`more-${section.id}`} className="px-1 text-ow-micro font-bold tracking-[0.08em] text-ow-muted uppercase">
              {section.name}
            </h2>
            <div className={cn("grid gap-2", "grid-cols-1 sm:grid-cols-2")}>
              {section.items.map((item) => (
                <Tile key={item.id} item={item} onClose={onClose} />
              ))}
            </div>
          </section>
        ))}
        <footer className="flex flex-col gap-2 border-t border-ow-hairline pt-4 text-ow-caption text-ow-muted">
          <p>{CREDIT}</p>
          <p className="text-ow-micro text-ow-helper">{CANTON_ATTRIBUTION}</p>
        </footer>
      </div>
    </Sheet>
  );
}
