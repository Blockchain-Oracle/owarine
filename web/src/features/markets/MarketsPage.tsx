"use client";

import { collateralOrNull } from "@owarine/markets";
import { LiveViewSwitcher } from "@/features/canton-ux/privacy";
import { leasedOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { MarketsScreen } from "./MarketsScreen";
import { TicketDock } from "./ticket";
import type { MarketsSelection } from "./useMarketsSelection";
import { LiveVerdict } from "./verdict";

/**
 * The ticket, wherever it belongs at this width.
 *
 * The balance plate that used to sit above it is gone from this rail — the header
 * carries the same reading (`HeaderAccount` → `useBalancePlate`), which is where
 * the reference keeps it, and two copies of one number on one screen is one too
 * many.
 */
function renderTicket(selection: MarketsSelection) {
  if (!selection.market) return null;
  return <TicketDock selection={{ ...selection, market: selection.market }} />;
}

function renderVerdict(selection: MarketsSelection) {
  if (!selection.marketId) return null;
  return <LiveVerdict marketId={selection.marketId} />;
}

/** §04 on `/markets/<id>` (§03 is the events board, C6e): the same ledger query as Alice, Bob, an outsider and (once leased) your own seat. */
function LedgerViewSection({ selection }: { selection: MarketsSelection }) {
  const lease = useSeatLeaseState();
  return <LiveViewSwitcher index="04" marketId={selection.marketId} symbol={collateralOrNull()?.symbol ?? "credits"} withSeat={leasedOf(lease.view) !== null} />;
}

const renderLedgerView = (selection: MarketsSelection) => <LedgerViewSection selection={selection} />;

/**
 * Client composition of the /markets island: the screen plus the surfaces that plug into its slots.
 *
 * The walkthrough mounts here, as the reference mounts it (markets/page.tsx L905):
 * `/markets` is the landing route, so first run happens where the product is.
 */
export function MarketsPage({ ledgerView = false }: { ledgerView?: boolean }) {
  return (
    <>
      <MarketsScreen renderTicket={renderTicket} renderVerdict={renderVerdict} renderLedgerView={ledgerView ? renderLedgerView : undefined} />
    </>
  );
}
