"use client";

import type { LivePnlView } from "@owarine/markets/react";
import { ArrowDownRight, ArrowUpRight, CandlestickChart, ChevronDown, LoaderCircle, Lock, Minus, Plus, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Odometer } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { cn } from "@/lib/utils";
import { formatPrice } from "../chart/engine";
import { ParlayRow, type ParlayMark } from "../parlay/ParlayRow";
import type { ScreenParlay } from "../parlay/useParlays";
import { PublishToggle } from "./PublishToggle";
import { clockText, moneyDecimals, multipleOf } from "../format";
import type { TerminalPosition } from "../useTerminalTrade";
export { positionValueBase } from "../position-value";

const num = (base: bigint, decimals: number) => Number(base) / 10 ** decimals;

export interface PositionsTotals {
  pnl: number;
  cost: number;
  /** Positions with no exit to price them by (locked before the close, or no bid yet): left out of `pnl`, never counted as 0. */
  unpriced: number;
}

export function totalsOf(positions: readonly TerminalPosition[], book: ReadonlyMap<string, LivePnlView>): PositionsTotals {
  let pnl = 0;
  let cost = 0;
  let unpriced = 0;
  for (const p of positions) {
    const v = book.get(p.id);
    if (v && v.fillableLots > 0n) {
      pnl += num(v.pnlBase, p.decimals);
      cost += num(p.costBasisBase, p.decimals);
    } else unpriced += 1;
  }
  return { pnl, cost, unpriced };
}

/** "Unrealized PnL", the total's rolling digits (decimals by size) and its % of what was put in; Close all when > 1. */
export function UnrealizedCard({ totals, count, closable = count, onCloseAll, closingAll }: { totals: PositionsTotals; count: number; closable?: number; onCloseAll: () => void; closingAll: boolean }) {
  const pct = totals.cost > 0 ? (totals.pnl / totals.cost) * 100 : 0;
  return (
    <div className="rounded-ow-card bg-ow-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-ow-caption text-ow-muted">Unrealized PnL</span>
        {closable > 1 ? (
          <button type="button" onClick={onCloseAll} disabled={closingAll} className="ow-down-soft flex items-center gap-1.5 rounded-full px-3 py-1 text-ow-micro font-bold">
            {closingAll ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {closingAll ? "Closing…" : `Close all (${closable})`}
          </button>
        ) : null}
      </div>
      {count > 0 && totals.unpriced === count ? (
        <>
          <p className="mt-1 text-ow-title font-bold text-ow-muted">—</p>
          <p className="flex items-center gap-1 text-ow-caption text-ow-muted">
            <Lock className="size-3.5" /> Locked · pays at the close
          </p>
        </>
      ) : (
        <>
          <Odometer kind="plain" signed tone zeroIsUp value={totals.pnl} decimals={moneyDecimals(totals.pnl)} className="mt-1 text-ow-title font-bold" />
          {count > 0 ? (
            <span className="flex items-center gap-1.5">
              <Odometer kind="pct" value={pct} decimals={2} className="block text-ow-caption font-semibold" />
              {totals.unpriced > 0 ? <span className="text-ow-caption text-ow-muted">· {totals.unpriced} locked</span> : null}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

export function PositionsList({
  positions, book, nowSec, onShare, onAdd, onReduce, onExits, parlays = [], marks,
}: {
  positions: readonly TerminalPosition[];
  book: ReadonlyMap<string, LivePnlView>;
  nowSec: number;
  onShare: (p: TerminalPosition) => void;
  onAdd: (p: TerminalPosition) => void;
  onReduce: (p: TerminalPosition) => void;
  /** R2: the position's TP / SL sheet (a live seat once the seat package is on the ledger). */
  onExits?: (p: TerminalPosition) => void;
  /** Open parlays (plan 2c), each with its mark at fair value. */
  parlays?: readonly ScreenParlay[];
  marks?: ReadonlyMap<string, ParlayMark>;
}) {
  if (positions.length === 0 && parlays.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-ow-card bg-ow-card p-6 text-ow-muted">
        <CandlestickChart className="size-10" strokeWidth={1.5} />
        <span className="text-ow-body">No open positions</span>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <span className="px-1 text-ow-micro font-bold tracking-[0.12em] text-ow-muted">POSITIONS</span>
      {parlays.map((p) => {
        const mark = marks?.get(p.id);
        return mark ? <ParlayRow key={p.id} p={p} mark={mark} nowSec={nowSec} /> : null;
      })}
      {positions.map((p) => (
        <PositionRow key={p.id} p={p} live={book.get(p.id) ?? null} nowSec={nowSec} onShare={onShare} onAdd={onAdd} onReduce={onReduce} onExits={onExits} />
      ))}
    </div>
  );
}

function PositionRow({ p, live, nowSec, onShare, onAdd, onReduce, onExits }: { p: TerminalPosition; live: LivePnlView | null; nowSec: number; onShare: (p: TerminalPosition) => void; onAdd: (p: TerminalPosition) => void; onReduce: (p: TerminalPosition) => void; onExits?: (p: TerminalPosition) => void }) {
  const [open, setOpen] = useState(false);
  const cost = num(p.costBasisBase, p.decimals);
  const priced = live !== null && live.fillableLots > 0n;
  const pnl = priced ? num(live.pnlBase, p.decimals) : 0;
  const roi = cost > 0 ? (pnl / cost) * 100 : 0;
  const held = p.side === "up" ? p.balanceUpRaw : p.balanceDownRaw;
  // A right call pays the contracts' face value, so the average price is cost ÷ face, in ticks of 1000.
  const avgTicks = held > 0n ? (1000 * Number(p.costBasisBase)) / Number(held) : 0;
  const nowTicks = p.side === "up" ? live?.upPriceTicks : live?.downPriceTicks;
  const locked = live?.locked ?? false;
  // A thin board takes only part of it: PnL covers that part, the rest stays at cost until it can sell or settles.
  const partial = priced && live.fillableLots < live.heldLots;
  const sellablePct = priced && live.heldLots > 0n ? Number((live.fillableLots * 100n) / live.heldLots) : 0;
  const Dir = p.side === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-ow-card bg-ow-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <AssetDisc asset={p.asset} className="asset-disc-32" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-ow-body font-bold">
            {p.asset}
            <Dir className={cn("size-4", p.side === "up" ? "text-ow-up" : "text-ow-down")} strokeWidth={2.75} />
            {p.mode === "demo" ? <span className="rounded-full bg-ow-recessed px-1.5 text-ow-micro font-semibold text-ow-muted">DEMO</span> : null}
          </span>
          <span className="block truncate text-ow-micro text-ow-muted">
            {cadence(p.intervalSec)} · {locked ? `settles ${clockText(p.expirySec)}` : `pays ${multipleOf(avgTicks)}`}
            {partial ? ` · ${sellablePct}% sellable now` : ""}
          </span>
        </span>
        <span className="flex flex-col items-end">
          {locked ? <Lock className="size-4 text-ow-muted" /> : <Odometer kind="pct" value={roi} decimals={1} className="text-ow-body font-bold" />}
          {priced ? <Odometer kind="plain" signed tone value={pnl} decimals={moneyDecimals(pnl)} className="text-ow-micro font-semibold" /> : <span className="text-ow-micro font-semibold text-ow-muted">—</span>}
        </span>
        <ChevronDown className={cn("size-4 text-ow-muted transition-transform", open && "rotate-180")} />
        <span
          role="button"
          tabIndex={0}
          aria-label="Share"
          onClick={(e) => (e.stopPropagation(), onShare(p))}
          onKeyDown={(e) => (e.key === "Enter" ? (e.stopPropagation(), onShare(p)) : undefined)}
          className="grid size-7 place-items-center rounded-full text-ow-muted hover:text-ow-ink"
        >
          <Share2 className="size-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-2 text-ow-caption">
              <Row k="Direction" v={<span className={p.side === "up" ? "text-ow-up" : "text-ow-down"}>{p.side === "up" ? "Up" : "Down"} / {cadence(p.intervalSec)}</span>} />
              <Row k="ROI" v={<Odometer kind="pct" value={roi} decimals={2} />} />
              <Row k="Avg in" v={`${(avgTicks / 10).toFixed(1)}¢`} />
              <Row k="Now" v={nowTicks ? `${(nowTicks / 10).toFixed(1)}¢` : "—"} />
              <Row k="Entry" v={p.entrySpot ? `$${formatPrice(p.entrySpot)}` : "—"} />
              <Row k="Line" v={<span className="text-ow-down">{p.linePrice ? `$${formatPrice(p.linePrice)}` : "—"}</span>} />
              <Row k="Staked" v={cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
              <Row k="Settles" v={`${clockText(p.expirySec)}${p.expirySec > nowSec ? "" : " · settling"}`} />
              {p.exit ? <Row k="Exit" v={exitWords(p)} /> : null}
            </dl>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <button type="button" disabled={locked} onClick={() => onAdd(p)} className="ow-up-soft flex h-9 items-center justify-center gap-1 rounded-full text-ow-caption font-bold disabled:opacity-40">
                <Plus className="size-4" /> Add
              </button>
              <button type="button" disabled={locked} onClick={() => onReduce(p)} className="flex h-9 items-center justify-center gap-1 rounded-full bg-ow-recessed text-ow-caption font-bold disabled:opacity-40">
                <Minus className="size-4" /> Reduce
              </button>
              {onExits && p.mode === "live" ? (
                <button type="button" disabled={locked} onClick={() => onExits(p)} className="flex h-9 items-center justify-center gap-1 rounded-full bg-ow-recessed text-ow-caption font-bold disabled:opacity-40">
                  {p.exit && (p.exit.takeProfitTicks !== null || (p.exit.stop && p.exit.stop.trailBps === null)) ? "Edit TP / SL" : "TP / SL"}
                </button>
              ) : null}
              {p.mode === "live" ? <PublishToggle marketId={p.marketId} /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** What the position's resting exit will do, in a few words. */
function exitWords(p: TerminalPosition): string {
  const x = p.exit!;
  const parts: string[] = [];
  if (x.stop) parts.push(`${x.stop.trailBps !== null ? "trail" : "stop"} $${formatPrice(Number(x.stop.stopE8) / 1e8)}`);
  if (x.takeProfitTicks !== null) parts.push(`take ${(x.takeProfitTicks / 10).toFixed(1)}¢`);
  return parts.join(" · ");
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-ow-muted">{k}</dt>
      <dd className="ow-num text-right">{v}</dd>
    </>
  );
}

const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`);
