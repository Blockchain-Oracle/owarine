"use client";

import { formatCadence } from "@owarine/core/copy";
import { PRIVATE_BUCKET, type PrivatePosition } from "@owarine/core/private";
import { formatBaseUnits } from "@owarine/core/units";
import { useTick } from "@owarine/markets/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PRIVATE } from "./copy";
import "./private-claims.css";

export interface PrivateClaimsProps {
  /** The seat's private calls under this lease, from the ledger; null while the first read is in flight. */
  positions: readonly PrivatePosition[] | null;
  decimals: number;
  symbol: string;
  onCashOut?: (position: PrivatePosition) => void;
  /** The pair being cashed out now. */
  busySlot?: string | null;
}

/** Two open calls on different BTC 4h Windows must not read as one row: the close time tells them apart. */
const closeLabel = (expirySec: number) => `${new Date(expirySec * 1000).toISOString().slice(11, 16)} UTC`;

function sinceLabel(tsSec: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - tsSec * 1000) / 60_000));
  if (mins < 1) return PRIVATE.claims.just;
  if (mins < 60) return PRIVATE.claims.minutes(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return PRIVATE.claims.hours(hrs);
  return PRIVATE.claims.days(Math.round(hrs / 24));
}

/**
 * Your private calls — the reference's `PrivateClaims.tsx` list on Canton (C8d, L-39). The reference kept a claim in the
 * browser because its desk kept no owner; on Canton the seat's own ledger holds every private call, seen only by the
 * seat and the venue, so the list reads the ledger and there is nothing to back up. A settled call shows its result; since
 * abu-pm-main 0.5.2 (K-315) its payout is already in the private balance ("in private balance", from the receipt), and
 * only a call the 0.5.1 engine paid into the public balance shows Cash out, which brings it home once.
 */
export function PrivateClaims({ positions, decimals, symbol, onCashOut, busySlot }: PrivateClaimsProps) {
  const beat = useTick(15_000);
  const nowMs = useMemo(() => Date.now(), [beat]);
  const rows = positions ?? [];
  return (
    <div className="pc">
      <div className="pc-head">
        <div>
          <h3 className="pc-title">{PRIVATE.claims.title}</h3>
          <p className="pc-sub">{PRIVATE.claims.sub}</p>
        </div>
      </div>

      {positions === null && <p className="pc-note">{PRIVATE.claims.checking}</p>}
      {positions !== null && rows.length === 0 && (
        <div className="pc-empty">
          <p className="pc-empty-title">{PRIVATE.claims.emptyTitle}</p>
          <p className="pc-empty-sub">{PRIVATE.claims.emptySub}</p>
        </div>
      )}

      <ul className="pc-list">
        {rows.map((p) => {
          const busy = busySlot === p.pairId;
          const cost = BigInt(p.costBase);
          const payout = p.payoutBase !== null ? BigInt(p.payoutBase) : null;
          return (
            <li key={p.pairId} className="pc-row">
              <div className="pc-row-main">
                <span className={cn("pc-side", p.side === "up" ? "is-up" : "is-down")}>{p.side === "up" ? "UP" : "DOWN"}</span>
                <span className="pc-strike">
                  {p.asset} {formatCadence(p.intervalSec)} · {closeLabel(p.expirySec)}
                </span>
                <span className="pc-stake">
                  {formatBaseUnits(cost, decimals)} {symbol}
                </span>
                {payout !== null && p.status !== "open" && (
                  <span className={cn("pc-payout", payout >= cost ? "is-win" : "is-loss")}>
                    {payout >= cost ? "+" : "−"}
                    {formatBaseUnits(payout >= cost ? payout - cost : cost - payout, decimals)}
                  </span>
                )}
                <span className="pc-when">{sinceLabel(p.openedAtSec, nowMs)}</span>
              </div>
              <div className="pc-row-side">
                <span className="pc-check is-ok" title={PRIVATE.claims.verifiedTitle}>
                  <ShieldCheck className="pc-icon" aria-hidden />
                  {PRIVATE.claims.verified}
                </span>
                {p.status === "settled" && onCashOut ? (
                  <button type="button" onClick={() => onCashOut(p)} disabled={busy} className="pc-cash" data-cursor="hover">
                    {busy ? <Loader2 className="pc-icon animate-spin" aria-hidden /> : null}
                    {busy ? PRIVATE.claims.cashingOut : PRIVATE.claims.cashOut}
                  </button>
                ) : p.status === "credited" && p.paidInto === PRIVATE_BUCKET ? (
                  <span className="pc-status" title={PRIVATE.claims.paidPrivateTitle}>
                    {PRIVATE.claims.paidPrivate}
                  </span>
                ) : (
                  <span className="pc-status">{p.status === "credited" ? PRIVATE.claims.credited : p.status === "settled" ? PRIVATE.claims.settled : PRIVATE.claims.open}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="pc-foot">{PRIVATE.claims.foot}</p>
    </div>
  );
}
