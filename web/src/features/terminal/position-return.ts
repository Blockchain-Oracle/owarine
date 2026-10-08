import type { LivePnlView } from "@owarine/markets/react";

/** Missing bids are not a break-even return. Only an executable exit can price open PnL. */
export function positionReturn(p: { costBasisBase: bigint; decimals: number; expirySec: number }, live: LivePnlView | null | undefined, nowSec: number) {
  const status: keyof typeof returnStatusText = p.expirySec <= nowSec ? "settling" : !live ? "unavailable" : live.locked || live.fillableLots === 0n ? "locked" : live.live ? "priced" : "stale";
  const priced = status === "priced" || status === "stale";
  const pnl = priced ? Number(live!.pnlBase) / 10 ** p.decimals : null;
  const roi = pnl !== null && p.costBasisBase > 0n ? (100 * Number(live!.pnlBase)) / Number(p.costBasisBase) : null;
  return { status, pnl, roi, canTrade: priced };
}

export const returnStatusText = {
  priced: "",
  stale: "Last quote · reconnecting",
  unavailable: "Live price unavailable · reconnecting",
  locked: "No cash-out quote · awaiting settlement",
  settling: "Settling · awaiting result",
} as const;
