"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Seal } from "@/components/kit";
import { OPEN_FUNDS_EVENT } from "@/features/funding";
import { cn } from "@/lib/utils";
import { HeaderAccount } from "../header/HeaderAccount";
import { HeaderMoneyPill } from "../header/HeaderMoneyPill";
import ThemeToggle from "../ThemeToggle";
import { isActiveNavItem, PLACES } from "../nav";
import { MoreSheet } from "./MoreSheet";

const ITEM = "flex h-10 items-center gap-3 rounded-ow-card px-3 text-ow-body text-ow-muted transition-colors hover:bg-ow-recessed hover:text-ow-ink aria-[current=page]:bg-ow-recessed aria-[current=page]:font-semibold aria-[current=page]:text-ow-ink";

/**
 * The desktop rail for every page that is not the trading screen (which draws Tradash's own nav in the same style):
 * the mark, Owarine's places, More (every page, in a sheet), and the account at the foot.
 */
export function AppRail() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  return (
    <aside className="ow-app-rail fixed inset-y-0 left-0 z-40 hidden w-[13.75rem] flex-col gap-1 border-r border-ow-hairline bg-ow-canvas p-4 lg:flex">
      <Link href="/" className="mb-4 flex items-center gap-2 px-1" aria-label="Owarine home">
        <span className="grid size-8 place-items-center rounded-full bg-ow-pink">
          <Seal size={20} tone="white" />
        </span>
        <span className="ow-display text-ow-lead">OWARINE</span>
      </Link>
      {PLACES.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActiveNavItem(pathname, item) ? "page" : undefined} className={ITEM}>
          <item.icon className="size-4.5" /> {item.name}
        </Link>
      ))}
      <button type="button" className={cn(ITEM, "text-left")} onClick={() => setMore(true)}>
        <LayoutGrid className="size-4.5" /> More
      </button>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderMoneyPill onOpen={() => window.dispatchEvent(new Event(OPEN_FUNDS_EVENT))} />
        </div>
        <HeaderAccount />
      </div>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </aside>
  );
}
