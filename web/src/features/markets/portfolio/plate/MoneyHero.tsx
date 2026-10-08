"use client";

import { formatBaseUnits } from "@owarine/core/units";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PillButton, PrivacyMask } from "@/components/kit";
import { cn } from "@/lib/utils";
import { PLATE } from "./copy";
import type { Money } from "./useMoney";

const fmt2 = (base: bigint, decimals: number) => formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 });

/** The three things the figure is made of, each in a sticker colour so the bar needs no legend. */
const LEGS = [
  { key: "credits", dot: "bg-ow-pink", label: PLATE.legs.credits },
  { key: "positions", dot: "bg-ow-sky", label: PLATE.legs.positions },
  { key: "collect", dot: "bg-ow-lime", label: PLATE.legs.collect },
] as const;

/**
 * The one thing a person comes to Portfolio for — what is mine right now — as UGLYCASH's black balance card (8 Oct
 * redesign, replacing the narrow cream plate): the figure (credits + open positions at the venue's mid + what waits to
 * be collected, C7a), what can be bet now, the two actions, and the split as a bar with its three legs. Pockets that are
 * yours but not in the figure are named under it, never added (FR-5).
 */
export function MoneyHero({ money, symbol, openBets, settled, onPrimary }: { money: Money; symbol: string; openBets: number; settled: number; onPrimary: () => void }) {
  const { decimals } = money;
  const credits = money.walletBase + money.accountBase;
  const empty = credits === 0n && money.positionsBase === 0n && money.claimableBase === 0n;
  const total = money.totalBase;
  const parts = { credits, positions: money.positionsBase, collect: money.claimableBase } as const;
  const pct = (part: bigint) => (total > 0n ? Number((part * 1000n) / total) / 10 : 0);
  const named = money.pools.filter((pool) => (pool.amountBase ?? 0n) > 0n);

  return (
    <section className="relative overflow-hidden rounded-ow-feature bg-ow-black p-6 text-ow-white ring-1 ring-ow-white/10 sm:p-8" aria-label={PLATE.balanceEyebrow}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-ow-label font-medium text-ow-white/60">{PLATE.balanceEyebrow}</span>
          <span className="flex flex-wrap items-baseline gap-x-3">
            <PrivacyMask size="lg">
              <span className={cn("ow-num text-ow-hero leading-none font-bold sm:text-ow-charm", !money.totalBaseReady && "opacity-50")}>{money.totalUnknown ? "0.00" : fmt2(total, decimals)}</span>
            </PrivacyMask>
            <span className="text-ow-title font-semibold text-ow-white/60">{symbol}</span>
          </span>
          <p className="text-ow-body text-ow-white/70">
            <span className="ow-num font-bold text-ow-white">{fmt2(money.readyToBetBase, decimals)}</span> {PLATE.readyToBet}
            {named.map((pool) => (
              <span key={pool.id}>
                {" · "}
                {pool.label} <span className="ow-num font-bold text-ow-white">{fmt2(pool.amountBase ?? 0n, decimals)}</span> {PLATE.notSummed}
              </span>
            ))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PillButton tone="pink" size="lg" onClick={onPrimary}>
              {empty ? PLATE.getTest : PLATE.addMoney}
            </PillButton>
            <PillButton tone="white" size="lg" className="bg-ow-white text-ow-black hover:bg-ow-white/90" nativeButton={false} render={<Link href="/trade/BTC" />}>
              {PLATE.trade} <ArrowRight aria-hidden />
            </PillButton>
          </div>
        </div>

        <dl className="grid w-full max-w-[22rem] gap-3">
          {LEGS.map((leg) => (
            <div key={leg.key} className="flex items-center gap-3">
              <span aria-hidden className={cn("size-3 shrink-0 rounded-full", leg.dot)} />
              <dt className="min-w-0 flex-1 truncate text-ow-label text-ow-white/70">{leg.label}</dt>
              <dd className="ow-num text-ow-lead font-bold">{fmt2(parts[leg.key], decimals)}</dd>
            </div>
          ))}
          <div className="flex items-center gap-3 border-t border-ow-white/15 pt-3 text-ow-label text-ow-white/70">
            <span>
              <span className="ow-num font-bold text-ow-white">{openBets}</span> {PLATE.open}
            </span>
            <span aria-hidden>·</span>
            <span>
              <span className="ow-num font-bold text-ow-white">{settled}</span> {PLATE.settled}
            </span>
          </div>
        </dl>
      </div>

      {/* The split, legible before any number is read: three segments, because the figure is three things. */}
      <div className="mt-8 flex h-3 gap-1 overflow-hidden rounded-full bg-ow-white/12" aria-hidden>
        {LEGS.map((leg) => {
          const width = pct(parts[leg.key]);
          return width > 0 ? <span key={leg.key} className={cn("h-full rounded-full", leg.dot)} style={{ width: `${width}%` }} /> : null;
        })}
      </div>
    </section>
  );
}
