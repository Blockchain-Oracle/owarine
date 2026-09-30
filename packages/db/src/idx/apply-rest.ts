/**
 * The pre-open resting call's rows (abu-pm-main 0.5.1, K-235). Placed by `RestOffer_Place` = a new row; a partial fill's
 * remainder = the row's new contract id and lots (the reference `callRef` is stable across it); `Rest_Cancel`, `Rest_Expire`
 * and a complete `Rest_Fill` end the row (cancelled, expired, filled) and keep it, so the portfolio can say how each ended.
 * Absolute values throughout, so a replayed update changes nothing.
 */
import type postgres from "postgres";
import type { IdxFact, IdxUpdate } from "./types";

type Tx = postgres.TransactionSql;

/** A resting call exists or changed. */
export async function restCallRow(tx: Tx, u: IdxUpdate, tsSec: number, f: Extract<IdxFact, { kind: "rest-call" }>, market: string): Promise<void> {
  if (f.placed) {
    const row = {
      call_ref: f.callRef, call_cid: f.contractId, market, terms_cid: f.termsCid, user_party: f.user, side: f.side, price_ticks: f.priceTicks,
      cash_unit: f.cashUnit, lots_placed: f.lotsPlaced, lots_remaining: f.lots, escrow_base: f.escrow, trading_start_sec: f.tradingStartSec,
      expires_at_sec: f.expiresAtSec, placed_update_id: u.updateId, placed_offset: u.offset, placed_ts_sec: tsSec,
    };
    await tx`INSERT INTO idx_resting ${tx(row)} ON CONFLICT (call_ref) DO NOTHING`;
    return;
  }
  await tx`
    UPDATE idx_resting SET call_cid = ${f.contractId}, lots_remaining = ${f.lots}::numeric, escrow_base = ${f.escrow}::numeric
    WHERE call_ref = ${f.callRef} AND status = 'open'`;
}

/** A call's contract ended. A filled call has nothing left resting; a cancelled or expired one keeps the lots it gave back (its filled part is placed - remaining). */
export async function restClosedRow(tx: Tx, u: IdxUpdate, tsSec: number, f: Extract<IdxFact, { kind: "rest-closed" }>): Promise<void> {
  await tx`
    UPDATE idx_resting SET status = ${f.how}, escrow_base = 0, refunded_base = ${f.refundedBase}::numeric,
      lots_remaining = CASE WHEN ${f.how} = 'filled' THEN 0 ELSE lots_remaining END, closed_update_id = ${u.updateId}, closed_ts_sec = ${tsSec}
    WHERE call_cid = ${f.contractId} AND status = 'open'`;
}
