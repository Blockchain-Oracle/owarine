"use client";

import { ArrowDownRight, ArrowUpRight, BadgePercent, ChevronDown, ChevronRight, Coins, Gauge, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Odometer, Seal } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { priceDecimals } from "../chart/engine";
import { moneyDecimals, untilText } from "../format";
import type { TerminalLane } from "../useTerminalWindow";
import { trailWords } from "./TradeButtons";

const tap = () => (playTrade("tap"), haptic("tap"));

/** Tradash's asset chip `a2`: logo, the live price in rolling digits ("—" before the first tick), "BTC · Bitcoin", chevron. */
export function AssetChip({ asset, name, price, onOpen }: { asset: string; name: string; price: number | null; onOpen: () => void }) {
  return (
    <button type="button" onClick={() => (tap(), onOpen())} className="ow-glass flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-left">
      <AssetDisc asset={asset} className="asset-disc-36" />
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-ow-lead font-bold">
          {price === null ? "—" : <Odometer kind="usd" value={price} decimals={priceDecimals(price)} />}
          <ChevronDown className="size-4 text-ow-muted" />
        </span>
        <span className="text-ow-micro text-ow-muted">
          {asset} · {name}
        </span>
      </span>
    </button>
  );
}

/** Owarine's addition: which Window length you trade, and how long until this Window's close print. */
export function WindowChip({ lanes, intervalSec, onPick, closeSec, lockSec, nowSec, state }: {
  lanes: readonly TerminalLane[];
  intervalSec: number | null;
  onPick: (sec: number) => void;
  closeSec: number | null;
  lockSec: number | null;
  nowSec: number;
  state: "trading" | "locked" | "next" | "none";
}) {
  return (
    <div className="ow-glass flex items-center gap-1 rounded-full p-1">
      {lanes.map((l) => (
        <button
          key={l.intervalSec}
          type="button"
          onClick={() => (tap(), onPick(l.intervalSec))}
          aria-pressed={l.intervalSec === intervalSec}
          className={cn("h-8 rounded-full px-3 text-ow-caption font-bold", l.intervalSec === intervalSec ? "bg-ow-ink text-ow-inverse" : "text-ow-muted hover:text-ow-ink")}
        >
          {l.label}
        </button>
      ))}
      <span className="ow-num px-2 text-ow-caption text-ow-muted">
        {state === "trading" && lockSec !== null ? `trades ${untilText(lockSec, nowSec)}` : state === "locked" && closeSec !== null ? `closes ${untilText(closeSec, nowSec)}` : state === "next" ? "next Window soon" : "no Window"}
      </span>
    </div>
  );
}

/** Tradash's equity pill `a5`: equity in rolling digits and the avatar; "Take a seat" with no account in live mode. */
export function EquityPill({ equity, demo, onOpen }: { equity: number | null; demo: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={() => (tap(), onOpen())} className="ow-glass flex h-11 items-center gap-2 rounded-full pr-1 pl-4">
      {demo ? <span className="rounded-full bg-ow-recessed px-1.5 text-ow-micro font-bold text-ow-muted">DEMO</span> : null}
      <span className="text-ow-lead font-bold">{equity === null ? "Take a seat" : <Odometer kind="plain" value={equity} decimals={2} />}</span>
      <span className="grid size-9 place-items-center rounded-full bg-ow-pink">
        <Seal size={22} tone="white" />
      </span>
    </button>
  );
}

/**
 * Tradash's floating order-settings stack `se`: flush to the left edge, glass, four rows (Size · Pays · Fees · Trailing);
 * it peeks in, can be dragged up and down, and a tap opens the settings sheet (a tap right after a drag is ignored).
 */
export function SettingsStack({ asset, size, pays, fees, trailPct, onOpen }: { asset: string; size: number; pays: string; fees: number | null; trailPct: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const dragged = useRef(0);
  const rows = [
    { icon: Coins, label: "Size", value: size.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { icon: Gauge, label: "Pays", value: pays },
    { icon: BadgePercent, label: "Fees", value: fees === null ? "Free" : fees.toFixed(moneyDecimals(fees)) },
    { icon: TrendingDown, label: "Trailing", value: `${(trailPct * 100).toFixed(2)}%` },
  ];
  return (
    <motion.button
      type="button"
      aria-label={`${asset} order settings`}
      drag={reduce ? false : "y"}
      dragConstraints={{ top: -160, bottom: 160 }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragStart={() => haptic("tap")}
      onDragEnd={() => (dragged.current = Date.now())}
      onClick={() => {
        if (Date.now() - dragged.current < 250) return;
        tap();
        onOpen();
      }}
      initial={reduce ? false : { x: -12, opacity: 0 }}
      animate={reduce ? { x: 0, opacity: 1 } : { x: [-12, 4, 4, 0], opacity: 1 }}
      transition={reduce ? undefined : { x: { duration: 2, times: [0, 0.15, 0.85, 1] }, opacity: { duration: 0.25 } }}
      className="ow-glass grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5 rounded-r-2xl border-l-0 py-2.5 pr-3 pl-2.5 text-left"
    >
      {rows.map((r) => (
        <span key={r.label} className="contents">
          <span className="grid size-5 place-items-center rounded-full bg-ow-recessed text-ow-muted">
            <r.icon className="size-3" strokeWidth={2.5} />
          </span>
          <span className="ow-num text-ow-micro font-semibold">
            <span className="sr-only">{r.label}: </span>
            {r.value}
          </span>
        </span>
      ))}
    </motion.button>
  );
}

/** Phone only: "View position" / "View N positions" with the total ROI, above the trade buttons. */
export function ViewPositionPill({ count, roiPct, onOpen }: { count: number; roiPct: number; onOpen: () => void }) {
  const Dir = roiPct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <button type="button" onClick={() => (tap(), onOpen())} className="ow-glass flex h-12 w-full items-center gap-3 rounded-full pr-3 pl-1.5">
      <span className={cn("grid size-9 place-items-center rounded-full", roiPct >= 0 ? "ow-up-soft" : "ow-down-soft")}>
        <Dir className="size-4" strokeWidth={2.75} />
      </span>
      <span className="flex-1 text-left text-ow-body font-semibold">{count === 1 ? "View position" : `View ${count} positions`}</span>
      <Odometer kind="pct" value={roiPct} decimals={1} className="text-ow-body font-bold" />
      <ChevronRight className="size-4 text-ow-muted" />
    </button>
  );
}

export { trailWords };
