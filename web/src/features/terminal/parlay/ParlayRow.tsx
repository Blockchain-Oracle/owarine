"use client";

import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, Layers, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Odometer } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { cn } from "@/lib/utils";
import { formatPrice } from "../chart/engine";
import { clockText, fixedText, money, moneyDecimals, untilText } from "../format";
import { legNow } from "./feeds";
import { legChance, legLead, markParlay } from "./price";
import type { ScreenLeg, ScreenParlay } from "./useParlays";

const CREDIT_DECIMALS = 6;
const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

export interface ParlayMark {
  /** What the ticket is worth now at fair value, in credits. */
  value: number;
  pnl: number;
  legs: Array<{ chance: number | null; lead: "ahead" | "behind" | null; spot: number | null; line: number | null }>;
}

/** A ticket at fair value now: each open leg's live chance (its fair at the live spot), times the payout. */
export function markOf(p: ScreenParlay, nowSec: number): ParlayMark {
  const legs = p.legs.map((l) => {
    const now = legNow(l.marketId, l.asset, l.lineE8);
    return { chance: l.status === "pending" ? legChance(now.ladder, l.side, now.spotE8, nowSec) : null, lead: legLead(l.side, now.spot, now.line), spot: now.spot, line: now.line };
  });
  const valueBase = markParlay(p.legs.map((l, i) => ({ status: l.status, chance: legs[i]!.chance, entryChance: l.entryChance })), p.stakeBase, p.maxPayoutBase);
  const value = valueBase / 10 ** CREDIT_DECIMALS;
  return { value, pnl: value - Number(p.stakeBase) / 10 ** CREDIT_DECIMALS, legs };
}

/** An open parlay in the positions list: its legs as chips that tick as they settle, its fair value breathing with the prices. */
export function ParlayRow({ p, mark, nowSec }: { p: ScreenParlay; mark: ParlayMark; nowSec: number }) {
  const [open, setOpen] = useState(false);
  const stake = Number(p.stakeBase) / 10 ** CREDIT_DECIMALS;
  const multiple = stake > 0 ? Number(p.maxPayoutBase) / Number(p.stakeBase) : 0;
  const roi = stake > 0 ? (mark.pnl / stake) * 100 : 0;
  const lastClose = Math.max(...p.legs.map((l) => l.expirySec));
  const pending = p.legs.filter((l) => l.status === "pending").length;
  return (
    <div className="rounded-ow-card bg-ow-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="flex shrink-0 -space-x-3">
          {p.legs.map((l) => (
            <AssetDisc key={l.marketId} asset={l.asset} className="asset-disc-32 ring-2 ring-ow-card" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-ow-body font-bold">
            <Layers className="size-3.5" /> Parlay
            {p.mode === "demo" ? <span className="rounded-full bg-ow-recessed px-1.5 text-ow-micro font-semibold text-ow-muted">DEMO</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-1 pt-0.5">
            {p.legs.map((l, i) => (
              <LegChip key={l.marketId} leg={l} lead={mark.legs[i]?.lead ?? null} />
            ))}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <Odometer kind="pct" value={roi} decimals={1} className="text-ow-body font-bold" />
          <Odometer kind="plain" signed tone value={mark.pnl} decimals={moneyDecimals(mark.pnl)} className="text-ow-micro font-semibold" />
        </span>
        <ChevronDown className={cn("size-4 text-ow-muted transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <ul className="flex flex-col gap-1.5 px-3 pb-2">
              {p.legs.map((l, i) => {
                const m = mark.legs[i];
                return (
                  <li key={l.marketId} className="flex items-center justify-between gap-3 rounded-2xl bg-ow-recessed px-2.5 py-1.5 text-ow-caption">
                    <span className="min-w-0">
                      <span className="block font-semibold whitespace-nowrap">
                        {l.asset} {l.side === "up" ? "Up" : "Down"} <span className="text-ow-muted">· {cadence(l.intervalSec)}</span>
                      </span>
                      <span className="ow-num block truncate text-ow-micro text-ow-muted">{m?.line ? `line $${formatPrice(m.line)}` : "line pending"}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      {l.status === "pending" ? (
                        <>
                          <span className="ow-num font-bold">{m?.chance != null ? `${fixedText(m.chance * 100, 0)}%` : "—"}</span>
                          <span className="ow-num text-ow-micro text-ow-muted">{l.expirySec > nowSec ? untilText(l.expirySec, nowSec) : "settling"}</span>
                        </>
                      ) : (
                        <span className={cn("font-bold", l.status === "won" ? "text-ow-up" : l.status === "lost" ? "text-ow-down" : "text-ow-muted")}>{l.status === "won" ? "Landed" : l.status === "lost" ? "Missed" : "Voided"}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-3 text-ow-caption">
              <Row k="Staked" v={money(p.stakeBase, CREDIT_DECIMALS)} />
              <Row k="Pays" v={`${money(p.maxPayoutBase, CREDIT_DECIMALS)} · ${multiple.toFixed(2)}×`} />
              <Row k="Worth now" v={money(BigInt(Math.round(mark.value * 10 ** CREDIT_DECIMALS)), CREDIT_DECIMALS)} />
              <Row k="Pays at" v={pending > 0 ? clockText(lastClose) : "settling"} />
            </dl>
            <p className="px-3 pb-3 text-ow-micro text-ow-muted">Every leg must land. A parlay can't be sold early; a voided Window returns the stake.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LegChip({ leg, lead }: { leg: ScreenLeg; lead: "ahead" | "behind" | null }) {
  const Dir = leg.side === "up" ? ArrowUpRight : ArrowDownRight;
  const tone =
    leg.status === "won" ? "bg-ow-up-line text-ow-white" : leg.status === "lost" ? "bg-ow-down-line text-ow-white" : leg.status === "void" ? "bg-ow-recessed text-ow-muted line-through" : lead === "ahead" ? "ow-up-soft" : lead === "behind" ? "ow-down-soft" : "bg-ow-recessed text-ow-ink";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-ow-micro font-bold transition-colors duration-150", tone)}>
      {leg.asset}
      {leg.status === "won" ? <Check className="size-3" strokeWidth={3} /> : leg.status === "lost" ? <X className="size-3" strokeWidth={3} /> : <Dir className="size-3" strokeWidth={3} />}
    </span>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-ow-muted">{k}</dt>
      <dd className="ow-num text-right">{v}</dd>
    </>
  );
}
