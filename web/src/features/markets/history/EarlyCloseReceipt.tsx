import type { SettledRound } from "@owarine/core/projection";
import { formatCadence } from "@owarine/core/copy";
import { shortHex } from "@owarine/core/units";
import { txUrl } from "@owarine/core/urls";
import { Money } from "@/components/data";
import { webEnv } from "@/lib/env";
import { OUTCOME_TO_SIDE } from "@owarine/core/types";
import { ShareTradeButton } from "@/features/share";
import { UtcTime } from "@/components/data/UtcTime";

/** Closing on the book returns sale proceeds; it is not a losing settlement with a zero payout. */
export function EarlyCloseReceipt({ round, symbol }: { round: SettledRound; symbol: string }) {
  return <article className="flex flex-col gap-5 rounded-(--market-card-radius) border border-(--market-card-border) bg-(--market-card-surface) p-4" aria-label="Cash-out receipt">
    <header className="flex items-start justify-between gap-4">
      <div><h3 className="type-body-strong">Closed early</h3><p className="type-caption text-ink-secondary">You sold this position before the round ended.</p></div>
      <div className="text-right"><span className="type-label-micro text-ink-muted">Net P&amp;L</span><Money value={round.pnlBase} decimals={round.decimals} symbol={symbol} tone="pnl" className="type-data-hero block" /></div>
    </header>
    <dl className="flex flex-col gap-2 type-data">
      <div className="flex justify-between gap-4"><dt>Window</dt><dd>{round.question ?? round.asset} · {formatCadence(round.intervalSec)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Paid in</dt><dd><Money value={round.stakeBase} decimals={round.decimals} symbol={symbol} /></dd></div>
      <div className="flex justify-between gap-4"><dt>Cash-out proceeds</dt><dd><Money value={round.proceedsBase} decimals={round.decimals} symbol={symbol} /></dd></div>
      <div className="flex justify-between gap-4"><dt>Fees paid</dt><dd><Money value={round.feeBase} decimals={round.decimals} symbol={symbol} /></dd></div>
      {round.source !== "vault" && <div className="flex justify-between gap-4"><dt>Entry transaction</dt><dd><a href={txUrl(round.entryTxHash, webEnv.markets.cluster)} target="_blank" rel="noreferrer" className="underline">{shortHex(round.entryTxHash, 10, 4)} ↗</a></dd></div>}
    </dl>
    {round.closedAtMs !== undefined && <UtcTime ms={round.closedAtMs} withDate className="type-caption text-ink-secondary" />}
    <p className="type-caption text-ink-secondary">Cash-out proceeds returned to your seat. No settlement payout is due for this closed position.</p>
    {round.closedAtMs !== undefined && <div className="flex justify-end"><ShareTradeButton card={{
      asset: round.asset, intervalSec: round.intervalSec, sides: round.sidesTraded.map((side) => OUTCOME_TO_SIDE[side]), outcome: "closed",
      lineRaw: null, closeRaw: null, stakeBase: round.stakeBase, payoutBase: round.proceedsBase, pnlBase: round.pnlBase,
      decimals: round.decimals, symbol, expirySec: round.expirySec, settledAtMs: round.closedAtMs,
      entryTxHash: round.source === "vault" ? null : round.entryTxHash, settlementTxHash: null, printSource: null, singleSource: false, voidReason: null,
    }} /></div>}
  </article>;
}
