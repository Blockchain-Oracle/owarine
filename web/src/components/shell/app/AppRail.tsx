"use client";

import { LayoutGrid } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Seal } from "@/components/kit";
import { DOCS_URL } from "@/lib/docs-url";
import { cn } from "@/lib/utils";
import { HeaderAccount } from "../header/HeaderAccount";
import { PLACES, placeOf } from "../nav";
import ThemeToggle from "../ThemeToggle";
import { BalanceChip } from "./BalanceChip";
import { ModeChip } from "./ModeChip";

/** The active pill's spring (roy-chain's rail, from 21st.dev #21517 "Animated Sidebar"). */
const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

const ROW = cn(
  "group relative flex h-(--nav-h) items-center gap-3 rounded-full px-3 outline-none",
  "justify-center xl:justify-start focus-visible:ring-2 focus-visible:ring-ow-rail-ink/70",
);

/**
 * The floating rail (Stage B2): Slush's anatomy by way of roy-chain's `rail.client.tsx` — fixed and inset so the canvas
 * shows around it, radius 32, 48 px rows on a 60 px pitch, a white pill under the place you are on that springs to the
 * next one. Black in Owarine's colours. Icons only below xl; hidden on phones, where the top bar and the dock take over.
 * Its foot carries the money, the seat and the theme.
 */
export function AppRail({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();
  const here = placeOf(pathname);
  const reduce = useReducedMotion();
  return (
    <aside
      aria-label="Owarine"
      className={cn(
        "ow-rail fixed top-(--rail-inset) bottom-(--rail-inset) left-(--rail-inset) z-40 hidden w-(--rail-w-collapsed) flex-col gap-6 overflow-y-auto overscroll-contain",
        "rounded-ow-sheet bg-ow-rail px-3 py-6 text-ow-rail-ink transition-colors duration-(--dur-flood) [scrollbar-width:none] md:flex xl:w-(--rail-w) xl:px-5",
        "[@media(max-height:53.75rem)]:gap-4 [@media(max-height:53.75rem)]:py-4",
      )}
    >
      <div className="flex flex-col items-center gap-3 xl:flex-row xl:justify-between">
        <Link href="/" aria-label="Owarine home" className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ow-rail-ink/70">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ow-pink">
            <Seal size={26} tone="white" />
          </span>
          <span className="ow-display hidden text-ow-title xl:inline">OWARINE</span>
        </Link>
        <ModeChip />
      </div>

      <nav aria-label="Main" className="flex flex-col gap-3 [@media(max-height:53.75rem)]:gap-1">
        {PLACES.map((item) => {
          const active = here?.id === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={`${item.name} — ${item.description} (${item.digit})`}
              className={cn(ROW, active ? "text-ow-rail-active-ink" : "text-ow-rail-muted hover:text-ow-rail-ink")}
            >
              {active ? (
                <motion.span layoutId="ow-rail-active" aria-hidden className="absolute inset-0 rounded-full bg-ow-rail-active" transition={reduce ? { duration: 0 } : SPRING} />
              ) : (
                <span aria-hidden className="absolute inset-0 rounded-full transition-colors duration-150 group-hover:bg-ow-rail-active/45" />
              )}
              <item.icon className="relative size-5.5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden />
              <span className="relative hidden text-ow-lead font-semibold tracking-[-0.01em] xl:inline">{item.name}</span>
              <kbd aria-hidden className={cn("relative ml-auto hidden font-sans text-ow-micro opacity-0 transition-opacity group-hover:opacity-100 xl:inline", active ? "text-ow-rail-active-ink/50" : "text-ow-rail-muted")}>
                {item.digit}
              </kbd>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          title="More — every other page"
          className={cn(ROW, here || !pathname ? "text-ow-rail-muted hover:text-ow-rail-ink" : "bg-ow-rail-active/45 text-ow-rail-ink")}
        >
          <span aria-hidden className="absolute inset-0 rounded-full transition-colors duration-150 group-hover:bg-ow-rail-active/45" />
          <LayoutGrid className="relative size-5.5 shrink-0" aria-hidden />
          <span className="relative hidden text-ow-lead font-semibold tracking-[-0.01em] xl:inline">More</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="hidden xl:block">
          <BalanceChip variant="rail" />
        </div>
        <HeaderAccount variant="rail" />
        <div className="flex flex-col items-center gap-2 xl:flex-row xl:justify-between">
          <ThemeToggle className="ow-rail-theme" />
          <span className="hidden items-center gap-3 text-ow-caption text-ow-rail-muted xl:flex">
            <a href={DOCS_URL} className="hover:text-ow-rail-ink">
              Docs
            </a>
            <Link href="/legal" className="hover:text-ow-rail-ink">
              Legal
            </Link>
          </span>
        </div>
      </div>
    </aside>
  );
}
