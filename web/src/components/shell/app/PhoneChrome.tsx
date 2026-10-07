"use client";

import { CandlestickChart, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FloatingDock, Seal } from "@/components/kit";
import { OPEN_FUNDS_EVENT } from "@/features/funding";
import { HeaderAccount } from "../header/HeaderAccount";
import { HeaderMoneyPill } from "../header/HeaderMoneyPill";
import { MoreSheet } from "./MoreSheet";

/** The phone shell: a slim top bar (mark, money, seat) and UGLYCASH's floating dock with the "everything" pill. */
export function PhoneChrome() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  return (
    <div className="lg:hidden">
      <header className="fixed inset-x-0 top-[var(--appstrip,0rem)] z-40 flex h-16 items-center justify-between gap-2 border-b border-ow-hairline bg-ow-canvas/90 px-3 backdrop-blur-md">
        <Link href="/" aria-label="Owarine home" className="grid size-9 place-items-center rounded-full bg-ow-pink">
          <Seal size={22} tone="white" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <HeaderMoneyPill onOpen={() => window.dispatchEvent(new Event(OPEN_FUNDS_EVENT))} />
          <HeaderAccount />
        </div>
      </header>
      <FloatingDock
        left={{ href: "/trade/BTC", label: "Trade", icon: <CandlestickChart />, active: pathname?.startsWith("/trade") ?? false }}
        right={{ href: "/portfolio", label: "Portfolio", icon: <Wallet />, active: pathname?.startsWith("/portfolio") ?? false }}
        onSearch={() => setMore(true)}
        searchLabel="Everything"
      />
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </div>
  );
}
