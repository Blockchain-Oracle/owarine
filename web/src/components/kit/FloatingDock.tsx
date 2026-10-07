"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Seal } from "./Seal";

/**
 * UGLYCASH's phone navigation: a black floating dock with two destinations either side of the brand mark, and a
 * "Search for anything" pill beside it. Fixed to the bottom on phones; the desktop shell uses the left rail instead.
 */
export interface DockItem {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}

export function FloatingDock({ left, right, centreHref = "/", onSearch, searchLabel, className }: { left: DockItem; right: DockItem; centreHref?: string; onSearch?: () => void; searchLabel?: string; className?: string }) {
  return (
    <nav aria-label="Main" className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0rem)+0.875rem)]", className)}>
      <div className="pointer-events-auto flex h-16 items-center gap-1 rounded-full bg-ow-black px-2 text-ow-white">
        <DockLink item={left} />
        <Link href={centreHref} aria-label="Home" className="grid size-12 place-items-center rounded-full bg-ow-pink">
          <Seal size={30} tone="white" />
        </Link>
        <DockLink item={right} />
      </div>
      {onSearch ? <SearchPill onClick={onSearch} {...(searchLabel ? { label: searchLabel } : {})} className="pointer-events-auto h-16" /> : null}
    </nav>
  );
}

function DockLink({ item }: { item: DockItem }) {
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={cn("flex h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-ow-micro font-semibold text-ow-white/60 transition-colors hover:text-ow-white aria-[current=page]:text-ow-white [&_svg]:size-5")}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}

/** The search entry point: a pill that opens the search sheet (assets, Windows, events, people, clubs). */
export function SearchPill({ className, label = "Search for anything", ...props }: ComponentProps<"button"> & { label?: string }) {
  return (
    <button
      type="button"
      className={cn("ow-body flex h-12 items-center gap-2.5 rounded-full bg-ow-card px-5 text-ow-body font-medium text-ow-muted transition-colors hover:text-ow-ink", className)}
      {...props}
    >
      <Search className="size-4.5" strokeWidth={2.5} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
