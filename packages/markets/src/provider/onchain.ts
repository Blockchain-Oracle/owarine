/**
 * Head-fresh Window reads from the ledger (first-call.md §2.2): the write gate's snapshot, a seat's holdings, and the
 * opening print. A Window whose contracts are archived answers from its projection row.
 */
import { ONCHAIN_STATUS } from "@owarine/core/lifecycle";
import type { Reading } from "@owarine/core/schemas";
import { diagnosis, type Address, type Holdings, type MarketId, type OnchainSnapshot } from "@owarine/core/types";
import { ReadingError } from "../errors/reading-error";
import { readMarket, readSeat, readSeries, readVenue } from "../runtime/accounts";
import { toOnchainSnapshot, winningOutcomeOf } from "../runtime/mappers";
import { nowSec } from "./clock";
import { big, indexRows, sec, type MarketRow, type PositionRow } from "./index-api";
import { marketRow } from "./markets";
import { rememberOpeningPrint, seenOpeningPrint } from "./opening-prints";
import { withReading } from "./reading";
import { heldAtSettlement } from "./rows";

/** A Window's Series never changes: once seen, a holdings poll reads only the Ledger. */
const seriesOfMarket = new Map<string, Address>();

/** The closed-Window snapshot, rebuilt from the index row the indexer kept. */
function snapshotFromRow(row: MarketRow, decimals: number, collateral: Address): OnchainSnapshot {
  const state = row.state;
  return {
    marketId: row.market as MarketId,
    marketAddress: row.market as Address,
    pool: (row.book ?? row.market) as Address,
    ledger: (row.ledger ?? row.market) as Address,
    nonce: big(row.market_index),
    collateral,
    status: state === "resolved" ? ONCHAIN_STATUS.Resolved : state === "voided" ? ONCHAIN_STATUS.Voided : ONCHAIN_STATUS.Locked,
    backing: big(row.backing_lots) * big(row.lot_base),
    finalized: state !== "open",
    lockAtSec: sec(row.lock_at_sec),
    expirySec: sec(row.expiry_sec),
    decimals,
    winningOutcome: winningOutcomeOf(Number(row.payout_yes ?? 0), Number(row.payout_no ?? 0)),
    isResolved: state === "resolved",
    isVoided: state === "voided",
  };
}

export async function getOnchain(marketId: MarketId): Promise<Reading<OnchainSnapshot>> {
  return withReading(`onchain:${marketId}`, async () => {
    const [market, venue] = await Promise.all([readMarket(marketId as string as Address), readVenue()]);
    if (market) {
      seriesOfMarket.set(marketId, market.data.series);
      return toOnchainSnapshot(market, await readSeries(market.data.series), venue, nowSec());
    }
    const row = await marketRow(marketId).catch(() => null);
    if (row && row.state !== "open") return snapshotFromRow(row, venue.decimals, venue.collateralMint);
    throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  });
}

/** Seat balances (free + locked) for one Window; a seat the settler already paid reads what it held at settlement. */
export async function getHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<Holdings>> {
  return withReading(`holdings:${wallet}:${onchain.marketId}`, async () => {
    const known = seriesOfMarket.get(onchain.marketId);
    const [series, seat] = await Promise.all([
      known ?? readMarket(onchain.marketId as string as Address).then((market) => market && (seriesOfMarket.set(onchain.marketId, market.data.series), market.data.series)),
      readSeat(onchain.ledger, wallet),
    ]);
    if (seat?.seat && series) {
      const { lotBase } = await readSeries(series);
      return { upRaw: (seat.seat.yesFree + seat.seat.yesLocked) * lotBase, downRaw: (seat.seat.noFree + seat.seat.noLocked) * lotBase };
    }
    if (!onchain.finalized) return { upRaw: 0n, downRaw: 0n };
    const rows = await indexRows<PositionRow>(`wallet/${wallet}/positions`);
    const row = rows.find((position) => position.market === onchain.marketId);
    if (!row) return { upRaw: 0n, downRaw: 0n };
    const held = heldAtSettlement(row);
    const lotBase = big(row.lot_base);
    return { upRaw: held.upLots * lotBase, downRaw: held.downLots * lotBase };
  });
}

/** The Window's opening print (× 10⁻⁸); null until recorded. Read from the projection's print rows until C4. */
export async function getOpeningPrice(marketId: MarketId): Promise<Reading<bigint | null>> {
  return withReading(`opening:${marketId}`, async () => {
    const seen = seenOpeningPrint(marketId);
    if (seen !== undefined) return seen;
    const open = (await marketRow(marketId))?.prints?.["0"];
    if (open) rememberOpeningPrint(marketId, BigInt(open.price));
    return open ? BigInt(open.price) : null;
  });
}
