"use client";

import { BarChart3, Clock, Gamepad2, LineChart, Settings, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/kit";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";

const tap = () => (playTrade("tap"), haptic("tap"));
const ITEM = "flex h-10 items-center gap-3 rounded-ow-card px-3 text-ow-body text-ow-muted transition-colors hover:bg-ow-recessed hover:text-ow-ink";

/**
 * Tradash's desktop nav: the mark, then Markets (the picker) · History · Statistics · Settings as sheets over the chart.
 * Owarine's other places follow under a rule (Additive in TRADASH-FIDELITY.md).
 */
export function TerminalNav({ onMarkets, onHistory, onAccountSettings }: { onMarkets: () => void; onHistory: () => void; onAccountSettings: () => void }) {
  return (
    <aside className="flex min-h-0 flex-col gap-1 border-r border-ow-hairline p-4">
      <Link href="/" className="mb-4 flex items-center gap-2 px-1" aria-label="Owarine home">
        <span className="grid size-8 place-items-center rounded-full bg-ow-pink">
          <Seal size={20} tone="white" />
        </span>
        <span className="ow-display text-ow-lead">OWARINE</span>
      </Link>
      <button type="button" className={ITEM} onClick={() => (tap(), onMarkets())}>
        <LineChart className="size-4.5" /> Markets
      </button>
      <button type="button" className={ITEM} onClick={() => (tap(), onHistory())}>
        <Clock className="size-4.5" /> History
      </button>
      <button type="button" className={ITEM} onClick={() => (tap(), onHistory())}>
        <BarChart3 className="size-4.5" /> Statistics
      </button>
      <button type="button" className={ITEM} onClick={() => (tap(), onAccountSettings())}>
        <Settings className="size-4.5" /> Settings
      </button>
      <hr className="my-3 border-ow-hairline" />
      <Link href="/portfolio" className={ITEM} onClick={tap}>
        <Wallet className="size-4.5" /> Portfolio
      </Link>
      <Link href="/games" className={ITEM} onClick={tap}>
        <Gamepad2 className="size-4.5" /> Games
      </Link>
      <Link href="/strategies" className={ITEM} onClick={tap}>
        <Sparkles className="size-4.5" /> Automate
      </Link>
    </aside>
  );
}
