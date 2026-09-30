"use client";

import type { RestingOrderView } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import { marketsProvider } from "@agari/markets";
import { useRestingOrders } from "@agari/markets/react";
import { leasedAddressOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import Link from "next/link";
import { Money } from "@/components/data";
import { formatCadence, PREOPEN } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { ListItem } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { SIDE_WORD } from "../side-styles";
import { useCancelResting } from "../ticket/useCancelResting";
import { useWhen } from "@/lib/when";

export interface RestingRowCancel {
  busy: boolean;
  note: string | null;
  onCancel: () => void;
}

export interface RestingRowViewProps {
  view: RestingOrderView;
  symbol: string | undefined;
  /** Null where nothing can sign (a fixture, or a call already off the Book). */
  cancel: RestingRowCancel | null;
}

const onBook = (view: RestingOrderView) => view.status === "resting-for-open" || view.status === "resting";

/** A call that ended stays in the Open tab this long, so its outcome is seen where it was watched; History keeps it for good. */
export const RECENT_END_SEC = 1_800;

function statusWord(view: RestingOrderView): string {
  switch (view.status) {
    case "resting-for-open":
      return PREOPEN.rows.restingForOpen;
    case "resting":
      return PREOPEN.rows.resting;
    case "filled":
      return PREOPEN.rows.filled;
    // Swept unfilled is "Didn't fill", never "Cancelled": the seat did not cancel it (a partly filled one says so).
    case "expired":
      return view.filledLots > 0n ? PREOPEN.rows.partlyFilled : PREOPEN.rows.expired;
    default:
      return PREOPEN.rows.cancelled;
  }
}

/**
 * One scheduled call in Portfolio (D-088), in `BetRow`'s anatomy: the state word where the live dot sits, the Window,
 * the call in the wallet's own terms ("UP at 55¢ · 10 contracts"), what is held, when it fills by, and Cancel while it
 * is on the Book. An ended call keeps its row and says how it ended: filled at the wallet's price (now a position),
 * swept unfilled ("Didn't fill"), or cancelled, with what came back as venue credit.
 */
export function RestingRowView({ view, symbol, cancel }: RestingRowViewProps) {
  const when = useWhen();
  const live = onBook(view);
  const contractsText = formatBaseUnits(view.placedContractsRaw, view.decimals, { minDp: 0 });
  return (
    <li className="bets-row" data-status={view.status}>
      <span className={cn("type-label-micro shrink-0", live ? "text-ink-secondary" : "text-ink")}>
        {live && (
          <span aria-hidden className="mr-1.5 text-ink-muted">
            ●
          </span>
        )}
        {statusWord(view)}
      </span>

      <Link href={marketDeepLink({ marketId: view.marketId })} data-cursor="hover" className="type-body-strong text-ink">
        {view.asset} {SIDE_WORD[view.side]}
      </Link>
      <span className="type-label-micro text-ink-muted">{formatCadence(view.intervalSec)}</span>
      <span className="type-caption text-ink-secondary">{PREOPEN.rows.call(SIDE_WORD[view.side], view.priceCents, contractsText)}</span>

      <span className="bets-break" aria-hidden />
      <span className="flex-1" />

      {live ? (
        <>
          <span className="type-caption text-ink-secondary">
            {PREOPEN.rows.held} <Money value={view.escrowBase} decimals={view.decimals} symbol={symbol} />
          </span>
          {/* `when` already carries the zone ("14:31 (09:31 ET)" or "09:31 ET"): the row adds none of its own. */}
          <span className="type-caption text-ink-secondary">{`${PREOPEN.rows.fillsBy} ${when(view.expireSec, { seconds: view.expireSec % 60 !== 0 })}`}</span>
        </>
      ) : (
        <span className="type-caption text-ink-secondary">
          {view.status === "filled" ? (
            PREOPEN.rows.filledWhy
          ) : (
            <>
              {view.filledLots > 0n ? `${PREOPEN.rows.partlyWhy} ` : view.refundedBase === 0n ? `${view.status === "expired" ? PREOPEN.rows.expiredWhy : PREOPEN.rows.cancelledWhy}` : ""}
              {view.refundedBase > 0n && (
                <>
                  {PREOPEN.rows.returned} <Money value={view.refundedBase} decimals={view.decimals} symbol={symbol} />
                </>
              )}
            </>
          )}
        </span>
      )}
      {live && cancel && (
        <button type="button" className="type-caption text-accent underline" disabled={cancel.busy} onClick={cancel.onCancel} data-cursor="hover">
          {cancel.busy ? PREOPEN.rows.cancelling : PREOPEN.rows.cancel}
        </button>
      )}
      {cancel?.note && (
        <span className="type-caption basis-full text-left text-warning sm:text-right" role="status">
          {cancel.note}
        </span>
      )}
    </li>
  );
}

/** The live row: Cancel sends `Rest_Cancel` on the call's own reference. */
function RestingRow({ view, symbol }: { view: RestingOrderView; symbol: string | undefined }) {
  const c = useCancelResting();
  const cancel: RestingRowCancel | null =
    c.canSign && view.handle ? { busy: c.busy, note: c.note, onCancel: () => void c.cancel(view.marketId, [view.handle as NonNullable<RestingOrderView["handle"]>]) } : null;
  return <RestingRowView view={view} symbol={symbol} cancel={cancel} />;
}

/**
 * The wallet's scheduled calls: `items` are the Open tab's, ahead of the positions — what rests now, and what ended in the
 * last half hour, so a call that did not fill is seen to have come back. `ended` is every call that ended (filled, swept
 * unfilled, cancelled), History's. A filled call is also a position and appears there too.
 */
export function useRestingItems(symbol: string | undefined): { items: ListItem[]; ended: ListItem[]; pending: boolean } {
  const { address: held } = useWalletSession();
  // No lease, no read: the seat's rows answer 403 until it holds one (C4c.2).
  const address = leasedAddressOf(useSeatLeaseState().view, held);
  const reading = useRestingOrders(address);
  if (!reading) return { items: [], ended: [], pending: address !== null };
  if (!isOk(reading)) return { items: [], ended: [], pending: false };
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const node = (view: RestingOrderView) => ({ key: `resting:${view.id}`, node: <RestingRow view={view} symbol={symbol} /> });
  const items = reading.value.filter((view) => onBook(view) || view.expireSec + RECENT_END_SEC > nowSec).map(node);
  const ended = reading.value.filter((view) => !onBook(view)).map(node);
  return { items, ended, pending: false };
}
