"use client";

import { Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Seal } from "./Seal";

/**
 * The phone's navigation (Stage B6): UGLYCASH's black floating dock with the seal in the middle, and roy-chain's
 * `mobile-dock.client.tsx` behaviour — a white pill under the place you are on that springs to the next (21st.dev Dock
 * #15742). An item is a link, or a button when it opens something (More).
 */
export interface DockItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** For a button that opens a sheet. */
  expanded?: boolean;
}

export function FloatingDock({ left, right, centreHref = "/", className }: { left: readonly DockItem[]; right: readonly DockItem[]; centreHref?: string; className?: string }) {
  const pillId = useId();
  const reduce = useReducedMotion();
  const cell = (item: DockItem) => <DockCell key={item.key} item={item} pillId={pillId} reduce={reduce === true} />;
  return (
    <nav aria-label="Main" className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0rem))]", className)}>
      <ul className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-ow-rail p-1.5 text-ow-rail-ink shadow-[0_12px_32px_-12px_var(--ow-scrim)] transition-colors duration-(--dur-flood)">
        {left.map(cell)}
        <li>
          <Link href={centreHref} aria-label="Owarine home" className="mx-1 grid size-12 place-items-center rounded-full bg-ow-pink outline-none focus-visible:ring-2 focus-visible:ring-ow-rail-ink">
            <Seal size={30} tone="white" />
          </Link>
        </li>
        {right.map(cell)}
      </ul>
    </nav>
  );
}

function DockCell({ item, pillId, reduce }: { item: DockItem; pillId: string; reduce: boolean }) {
  const className = cn(
    "relative flex h-13 min-w-15 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-ow-micro font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ow-rail-ink/70 [&_svg]:size-5",
    item.active ? "text-ow-rail-active-ink" : "text-ow-rail-muted hover:text-ow-rail-ink",
  );
  const body = (
    <>
      {item.active ? <motion.span layoutId={pillId} aria-hidden className="absolute inset-0 -z-10 rounded-full bg-ow-rail-active" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} /> : null}
      {item.icon}
      <span className="leading-none">{item.label}</span>
    </>
  );
  return (
    <li className="relative isolate">
      {item.href ? (
        <Link href={item.href} aria-current={item.active ? "page" : undefined} className={className}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={item.onClick} aria-haspopup="dialog" aria-expanded={item.expanded} className={className}>
          {body}
        </button>
      )}
    </li>
  );
}

/** The search entry point: a pill that opens search. */
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
