import { formatCadence } from "@owarine/core/copy";
import type { RestingOrderView } from "@owarine/core/projection";
import { formatBaseUnits } from "@owarine/core/units";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useCancelResting } from "@/features/markets/ticket/useCancelResting";
import { PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { BetsRow, Break, Call, Caption, Micro, MoneyText, RowNote, Status, TextAction } from "./RowParts";

const onBook = (view: RestingOrderView) => view.status === "resting-for-open" || view.status === "resting";

function statusWord(view: RestingOrderView): string {
  if (view.status === "resting-for-open") return PREOPEN.rows.restingForOpen;
  if (view.status === "resting") return PREOPEN.rows.resting;
  if (view.status === "filled") return PREOPEN.rows.filled;
  // Swept unfilled is "Didn't fill", never "Cancelled": the seat did not cancel it (a partly filled one says so).
  if (view.status === "expired") return view.filledLots > 0n ? PREOPEN.rows.partlyFilled : PREOPEN.rows.expired;
  return PREOPEN.rows.cancelled;
}

/** What an ended call says instead of "fills by": filled at the wallet's price, or what came back as venue credit. */
function endedLine(view: RestingOrderView, money: (base: bigint) => string): string {
  if (view.status === "filled") return PREOPEN.rows.filledWhy;
  const returned = view.refundedBase > 0n ? `${PREOPEN.rows.returned} ${money(view.refundedBase)}` : view.status === "expired" ? PREOPEN.rows.expiredWhy : PREOPEN.rows.cancelledWhy;
  if (view.filledLots === 0n) return returned;
  // What filled of a call that filled in part, in contracts: the placed size pro rata to the lots that filled.
  const filled = formatBaseUnits(view.lots > 0n ? (view.placedContractsRaw * view.filledLots) / view.lots : 0n, view.decimals, { minDp: 0 });
  return `${PREOPEN.rows.partlyWhy(filled, formatBaseUnits(view.placedContractsRaw, view.decimals, { minDp: 0 }))} · ${returned}`;
}

/**
 * web `RestingRowView` + `RestingRow` (D-088): the state word, the Window, the call in the wallet's own terms, what is
 * held, when it fills by, and Cancel (`Rest_Cancel` on its own reference) while it is on the Book. An ended call keeps
 * its row and says how it ended: filled at the wallet's price, swept unfilled ("Didn't fill"), or cancelled.
 */
export function RestingRow({ view, symbol, first }: { view: RestingOrderView; symbol: string | undefined; first: boolean }) {
  const when = useWhen();
  const c = useCancelResting();
  const live = onBook(view);
  const contracts = formatBaseUnits(view.placedContractsRaw, view.decimals, { minDp: 0 });
  const canCancel = live && c.canSign && view.handle !== null && view.handle !== undefined;
  return (
    <BetsRow first={first}>
      <Status word={statusWord(view)} dot={live ? "muted" : null} />
      <Call marketId={view.marketId} asset={null} text={`${view.asset} ${SIDE_WORD[view.side]}`} />
      <Micro>{formatCadence(view.intervalSec)}</Micro>
      <Caption>{PREOPEN.rows.call(SIDE_WORD[view.side], view.priceCents, contracts)}</Caption>
      <Break />
      {live ? (
        <>
          <Caption>
            {PREOPEN.rows.held} <MoneyText value={view.escrowBase} decimals={view.decimals} symbol={symbol} />
          </Caption>
          {/* `when` already carries the zone ("14:31 (09:31 ET)" or "09:31 ET"): the row adds none of its own. */}
          <Caption>{`${PREOPEN.rows.fillsBy} ${when(view.expireSec, { seconds: view.expireSec % 60 !== 0 })}`}</Caption>
        </>
      ) : (
        <Caption>{endedLine(view, (base) => `${formatBaseUnits(base, view.decimals)}${symbol ? ` ${symbol}` : ""}`)}</Caption>
      )}
      {canCancel ? (
        <TextAction
          label={c.busy ? PREOPEN.rows.cancelling : PREOPEN.rows.cancel}
          disabled={c.busy}
          onPress={() => void c.cancel(view.marketId, [view.handle as NonNullable<RestingOrderView["handle"]>])}
        />
      ) : null}
      <RowNote text={c.note} />
    </BetsRow>
  );
}
