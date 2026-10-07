"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Odometer } from "./Odometer";
import { PrivacyMask } from "./PrivacyMask";

/**
 * UGLYCASH's position card on the trade sheet: what it is worth now (live, rolling), the average entry, what went in,
 * and the PnL that flips green/red with its sign. "Worth now" is the exit quote — what Close pays — not a mid-price.
 */
export interface PositionCardProps {
  title: ReactNode;
  side: "up" | "down";
  /** Live exit value in dollars: what Close pays right now. */
  value: number;
  /** Dollars paid, fees included. */
  invested: number;
  /** Average entry price per contract, already formatted by the caller (cents or a price level). */
  avgIn: ReactNode;
  /** Optional line under the title: the Window and its close time. */
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PositionCard({ title, side, value, invested, avgIn, meta, action, className }: PositionCardProps) {
  const pnl = value - invested;
  const pct = invested > 0 ? (pnl / invested) * 100 : 0;
  return (
    <div data-slot="position-card" className={cn("rounded-ow-card bg-ow-card p-5 text-ow-ink", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ow-body truncate text-ow-lead font-bold">{title}</p>
          {meta ? <p className="ow-body mt-0.5 text-ow-caption text-ow-muted">{meta}</p> : null}
        </div>
        <span data-dir={side} className="ow-display shrink-0 rounded-full bg-(--ow-dir-line) px-2.5 pt-1.5 pb-1 text-ow-body text-ow-white">
          {side === "up" ? "UP" : "DOWN"}
        </span>
      </div>
      <p className="ow-body mt-4 text-ow-caption font-medium text-ow-muted">Worth now</p>
      <PrivacyMask size="lg">
        <Odometer value={value} kind="usd" className="text-ow-figure leading-none font-extrabold tracking-[-0.04em]" />
      </PrivacyMask>
      <div className="mt-1.5 flex items-baseline gap-2 text-ow-body font-bold">
        <PrivacyMask size="sm">
          <Odometer value={pnl} kind="pnl" decimals={2} />
        </PrivacyMask>
        <Odometer value={pct} kind="pct" className="text-ow-caption font-semibold" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ow-hairline pt-4 text-ow-label">
        <div>
          <dt className="text-ow-muted">Avg in</dt>
          <dd className="ow-num mt-0.5 font-bold">{avgIn}</dd>
        </div>
        <div>
          <dt className="text-ow-muted">Invested</dt>
          <dd className="mt-0.5 font-bold">
            <PrivacyMask size="sm">
              <Odometer value={invested} kind="usd" />
            </PrivacyMask>
          </dd>
        </div>
      </dl>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
