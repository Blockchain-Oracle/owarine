"use client";

import { PARLAY_MAX_LEGS } from "@owarine/core/parlay";
import { ArrowDownRight, ArrowUpRight, Layers, LoaderCircle, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Odometer, PillButton } from "@/components/kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { haptic } from "@/lib/haptics";
import { playTrade } from "@/lib/sound/trade";
import { cn } from "@/lib/utils";
import { fixedText, money, untilText } from "../format";
import { legNow } from "./feeds";
import { legChance, legLead, type ParlayEstimate } from "./price";
import { clearSlip, legOpen, removeLeg, setSlipStake, type SlipLeg } from "./slip";

const CREDIT_DECIMALS = 6;
const STAKE_CHIPS = [1, 5, 20, 50] as const;
const tap = () => (playTrade("tap"), haptic("tap"));
const cadence = (sec: number) => (sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

/**
 * The parlay slip (plan 2c): two or three Windows of any markets on one ticket, priced live — each leg's price, the
 * combined chance and what the ticket pays move with the ladders and spots — and placed in one tap. Every leg must
 * land; the full payout is set aside when it is placed.
 */
export function ParlaySlip({ legs, estimate, stakeCredits, nowSec, busy, demo, onPlace, onAddMarket, className }: {
  legs: readonly SlipLeg[];
  estimate: ParlayEstimate;
  stakeCredits: number;
  nowSec: number;
  busy: boolean;
  demo: boolean;
  onPlace: () => void;
  onAddMarket: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const quote = estimate.ok ? estimate.quote : null;
  const multiple = quote ? quote.multiplierMilli / 1000 : 0;
  const chancePct = quote ? Number((quote.combinedProbRaw * 10_000n) / 1_000_000n) / 100 : null;
  const failedLeg = estimate.ok ? null : estimate.legIdx;

  return (
    <div className={cn("flex flex-col gap-3 rounded-ow-card bg-ow-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-ow-micro font-bold tracking-[0.12em] text-ow-muted">
          <Layers className="size-3.5" /> PARLAY · {legs.length}/{PARLAY_MAX_LEGS}
          {demo ? <span className="rounded-full bg-ow-recessed px-1.5 tracking-normal">DEMO</span> : null}
        </span>
        {legs.length > 0 ? (
          <button type="button" onClick={() => (tap(), clearSlip())} className="text-ow-micro font-semibold text-ow-muted hover:text-ow-ink">
            Clear
          </button>
        ) : null}
      </div>

      {legs.length === 0 ? (
        <p className="text-ow-caption text-ow-muted">Tap UP or DOWN to add this market. Then pick another market and add it too. Every leg must land, and the odds multiply.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {legs.map((leg, i) => (
              <motion.li
                key={leg.marketId}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <SlipLegRow leg={leg} priceBps={quote?.legProbBps[i] ?? null} nowSec={nowSec} flagged={failedLeg === i} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {legs.length < PARLAY_MAX_LEGS ? (
        <button type="button" onClick={() => (tap(), onAddMarket())} className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-dashed border-ow-hairline text-ow-caption font-semibold text-ow-muted hover:text-ow-ink">
          <Plus className="size-4" /> {legs.length === 0 ? "Pick a market" : "Add another market"}
        </button>
      ) : null}

      {legs.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ow-caption text-ow-muted">Stake</span>
            <div className="flex items-center gap-1">
              {STAKE_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => (tap(), setSlipStake(c))}
                  aria-pressed={stakeCredits === c}
                  className={cn("h-7 min-w-9 rounded-full px-2 text-ow-micro font-bold", stakeCredits === c ? "bg-ow-ink text-ow-inverse" : "bg-ow-recessed text-ow-ink")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-ow-caption text-ow-muted">Pays</span>
              {quote ? (
                <span className="flex items-baseline gap-0.5 text-ow-title font-bold">
                  <Odometer kind="plain" value={multiple} decimals={2} />×
                </span>
              ) : (
                <span className="text-ow-title font-bold text-ow-muted">—</span>
              )}
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-ow-caption text-ow-muted">If all {legs.length} land</span>
              {quote ? <Odometer kind="plain" value={Number(quote.maxPayoutBase) / 10 ** CREDIT_DECIMALS} decimals={2} className="text-ow-lead font-bold text-ow-up" /> : <span className="text-ow-lead font-bold text-ow-muted">—</span>}
            </div>
          </div>

          <p className={cn("text-ow-micro", estimate.ok ? "text-ow-muted" : "text-ow-down")}>
            {quote
              ? `${chancePct === null ? "" : `${fixedText(chancePct, chancePct < 10 ? 1 : 0)}% chance all land`}${quote.correlated ? " · legs close together, so the odds are trimmed" : ""}`
              : estimate.ok
                ? ""
                : estimate.why}
          </p>

          <PillButton tone="pink" size="lg" block disabled={!quote || busy} onClick={onPlace}>
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            {busy ? "Placing…" : quote ? `Place parlay · ${money(quote.stakeBase, CREDIT_DECIMALS)}` : "Place parlay"}
          </PillButton>
          <p className="text-center text-ow-micro text-ow-muted">Can't be sold early. Pays when the last leg closes.</p>
        </>
      ) : null}
    </div>
  );
}

function SlipLegRow({ leg, priceBps, nowSec, flagged }: { leg: SlipLeg; priceBps: number | null; nowSec: number; flagged: boolean }) {
  const now = legNow(leg.marketId, leg.asset);
  const chance = priceBps !== null ? priceBps / 10_000 : legChance(now.ladder, leg.side, now.spotE8, nowSec);
  const lead = legLead(leg.side, now.spot, now.line);
  const Dir = leg.side === "up" ? ArrowUpRight : ArrowDownRight;
  const open = legOpen(leg, nowSec);
  return (
    <div className={cn("flex items-center gap-2.5 rounded-2xl bg-ow-recessed px-2.5 py-2", flagged && "outline outline-1 outline-ow-down")}>
      <AssetDisc asset={leg.asset} className="asset-disc-32" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-ow-body font-bold">
          {leg.asset}
          <Dir className={cn("size-4", leg.side === "up" ? "text-ow-up" : "text-ow-down")} strokeWidth={2.75} />
          <span className="text-ow-micro font-semibold text-ow-muted">{cadence(leg.intervalSec)}</span>
        </span>
        <span className="block truncate text-ow-micro text-ow-muted">
          {open ? untilText(leg.expirySec, nowSec) : "next Window…"}
          {lead ? <span className={lead === "ahead" ? "text-ow-up" : "text-ow-down"}> · {lead === "ahead" ? "ahead" : "behind"}</span> : null}
        </span>
      </span>
      <span className="ow-num text-ow-caption font-bold">{chance === null ? "—" : `${fixedText(chance * 100, 0)}¢`}</span>
      <button type="button" aria-label={`Remove ${leg.asset}`} onClick={() => (tap(), removeLeg(leg.marketId))} className="grid size-7 place-items-center rounded-full text-ow-muted hover:bg-ow-card hover:text-ow-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}
