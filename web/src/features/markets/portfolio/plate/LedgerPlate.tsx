"use client";

import { formatBaseUnits } from "@owarine/core/units";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PLATE } from "./copy";
import type { Money } from "./useMoney";
import "./ledger-plate.css";

const fmt2 = (base: bigint, decimals: number) => formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 });

/** One leg of the balance, tied to its segment by colour so the bar needs no legend of its own. */
function Leg({ leg, label, value }: { leg: "wallet" | "positions" | "account"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("lp-leg-dot", `lp-leg-dot--${leg}`)} />
      <span className="lp-leg-label">{label}</span>
      <span className="lp-leg-value">{value}</span>
    </div>
  );
}

interface LedgerPlateProps {
  money: Money;
  symbol: string;
  openBets: number;
  settled: number;
  onPrimary: () => void;
  /** Task rows and the pool list live inside this plate: the account is the parent, they are its children. */
  children?: ReactNode;
}

/**
 * The one thing a person arrives at this page to find out: what is mine, right now.
 * Ported from `reference/yosuku/components/portfolio/BalancePlate.tsx`, with the reference's balance sheet as the one
 * number (C7a): demo credits, plus open positions marked at the venue ladder's mid, plus what is waiting to be
 * collected. What can be bet right now is said under it. Every other pool is named under it and listed as its own row
 * below, never summed into the figure (FR-5).
 */
export function LedgerPlate({ money, symbol, openBets, settled, onPrimary, children }: LedgerPlateProps) {
  const { decimals } = money;
  const credits = money.walletBase + money.accountBase;
  const empty = credits === 0n && money.positionsBase === 0n && money.claimableBase === 0n;
  const total = money.totalBase;
  const pct = (part: bigint) => (total > 0n ? Number((part * 1000n) / total) / 10 : 0);
  /** Pools that are yours but not in this figure: named with their amounts, never added. */
  const named = money.pools.filter((pool) => (pool.amountBase ?? 0n) > 0n);

  return (
    <div className="ledger-plate">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lp-eyebrow">{PLATE.balanceEyebrow}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("lp-figure", !money.totalBaseReady && "lp-figure--pending")}>{money.totalUnknown ? "0.00" : fmt2(total, decimals)}</span>
            <span className="lp-unit">{symbol}</span>
          </div>
          <div className="lp-elsewhere">
            <span className="lp-elsewhere-ink">{fmt2(money.readyToBetBase, decimals)}</span> {PLATE.readyToBet}
            {named.map((pool) => (
              <span key={pool.id}>
                {" · "}
                {pool.label} <span className="lp-elsewhere-ink">{fmt2(pool.amountBase ?? 0n, decimals)}</span> {PLATE.notSummed}
              </span>
            ))}
          </div>
        </div>

        <button type="button" onClick={onPrimary} className="btn btn-primary shrink-0 max-sm:w-full" data-cursor="hover">
          {empty ? PLATE.getTest : PLATE.addMoney}
        </button>
      </div>

      {/* A proportion bar, not a spec strip: the split is legible before any number is read. Three segments, because
          the figure is three things: credits, open positions at the mid, and what is waiting to be collected. */}
      <div className="mt-4">
        <div className="lp-bar">
          <div className="lp-bar-wallet" style={{ width: `${pct(credits)}%` }} />
          <div className="lp-bar-positions" style={{ width: `${pct(money.positionsBase)}%` }} />
          <div className="lp-bar-account" style={{ width: `${pct(money.claimableBase)}%` }} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
          <Leg leg="wallet" label={PLATE.legs.credits} value={fmt2(credits, decimals)} />
          <Leg leg="positions" label={PLATE.legs.positions} value={fmt2(money.positionsBase, decimals)} />
          <Leg leg="account" label={PLATE.legs.collect} value={fmt2(money.claimableBase, decimals)} />
          <div className="lp-counts">
            <span className="lp-counts-ink">{openBets}</span> {PLATE.open}
            <span className="lp-counts-sep">·</span>
            <span className="lp-counts-ink">{settled}</span> {PLATE.settled}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
