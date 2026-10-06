import { PRIVATE_BUCKET, type PrivatePosition } from "@agari/core/private";
import type { PrivatePositionRow } from "@agari/db";

/**
 * A private call's row. 0.5.2 (K-315): a receipt naming the private bucket, or a stale refund (which leaves no receipt and
 * refunds into the private bucket), is home at once; a 0.5.1 receipt paid the public balance and waits for Cash out until
 * its dismissal says it came home.
 */
export function positionOf(r: PrivatePositionRow): PrivatePosition {
  const paidPrivate = r.paid_into === PRIVATE_BUCKET;
  const refundedStale = !r.receipt_cid && r.status === "refunded_stale";
  const status = r.dismissed === true || paidPrivate || refundedStale ? "credited" : r.receipt_cid ? "settled" : "open";
  const result = r.result === "won" || r.result === "lost" || r.result === "void" ? r.result : null;
  return {
    pairId: r.pair_id, marketId: r.market_key, asset: r.symbol ?? "", intervalSec: r.cadence_sec ?? 0, expirySec: Number(r.expiry_sec),
    side: r.outcome === 0 ? "up" : "down", lots: r.lots, costBase: (BigInt(r.backing_share) + BigInt(r.fee_paid)).toString(), status, result,
    payoutBase: r.payout ?? (refundedStale ? r.leg_paid : null), paidInto: paidPrivate || refundedStale ? PRIVATE_BUCKET : null,
    openedUpdateId: r.created_update_id, openedAtSec: Number(r.created_ts_sec),
  };
}
