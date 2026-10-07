/**
 * Another seat's record, from its opt-in publications only (plan §5, C13a). On Solana a profile read any wallet's
 * fills; on Canton a seat's rows are private, so `/u/<address>` for anyone but the viewer replays the calls that seat
 * chose to publish (`/api/index/published/<address>/*`) through the same replay as the seat's own history. What it
 * never published is not here, and nothing says it is.
 */
import type { LedgerFill, WalletHistory } from "@owarine/core/projection";
import type { Reading } from "@owarine/core/schemas";
import type { Address, MarketId, OpenPosition } from "@owarine/core/types";
import { readVenueStatic } from "../runtime/accounts";
import { marketRows, pageAll, PAGE, replayHistory, toLedgerFill, type ReplayedWindow } from "./history";
import { big, indexRows, sec, type FillRow, type ReceiptRow } from "./index-api";
import { withReading } from "./reading";

const TICKS = 1000n;

async function replayPublished(address: Address) {
  const [fills, receipts, venue] = await Promise.all([
    pageAll<FillRow>(`published/${address}/fills`),
    indexRows<ReceiptRow>(`published/${address}/receipts`, { limit: PAGE }),
    readVenueStatic(),
  ]);
  return replayHistory(address, { fills, actions: { rows: [], complete: true }, positions: [], receipts }, venue.decimals).then((r) => ({ ...r, decimals: venue.decimals }));
}

/**
 * A published open call as the portfolio's row. Its value uses the Window's last price only where the venue shows it
 * (k >= 5 participants); below that no mark is public, so the value is the stake and no P&L is claimed.
 */
export function publishedOpenPosition({ ledger, row }: ReplayedWindow, decimals: number): OpenPosition {
  const one = 10n ** BigInt(decimals);
  const held = ledger.heldUpRaw + ledger.heldDownRaw;
  const tickBase = big(row.tick_base);
  const markValueBase =
    row.last_price_ticks === null
      ? ledger.costBase
      : (ledger.heldUpRaw * BigInt(row.last_price_ticks) * tickBase + ledger.heldDownRaw * (TICKS - BigInt(row.last_price_ticks)) * tickBase) / one;
  return {
    marketId: row.market as MarketId,
    asset: row.symbol ?? "",
    intervalSec: row.cadence_sec ?? 0,
    expirySec: sec(row.expiry_sec),
    decimals,
    balanceUpRaw: ledger.heldUpRaw,
    balanceDownRaw: ledger.heldDownRaw,
    costBasisBase: ledger.costBase,
    avgCostRaw: held === 0n ? 0n : (ledger.costBase * one) / held,
    markValueBase,
    unrealizedPnlBase: markValueBase - ledger.costBase,
    realizedPnlBase: ledger.proceedsBase,
  };
}

/** Another seat's settled record, from its publications. */
export function listPublishedHistory(address: Address): Promise<Reading<WalletHistory>> {
  return withReading(`published-history:${address}`, async () => (await replayPublished(address)).history);
}

/** Another seat's open published calls, newest Window last to close first. */
export function listPublishedCalls(address: Address): Promise<Reading<OpenPosition[]>> {
  return withReading(`published-calls:${address}`, async () => {
    const { open, decimals } = await replayPublished(address);
    return open.map((w) => publishedOpenPosition(w, decimals)).sort((a, b) => a.expirySec - b.expirySec);
  });
}

/**
 * Another seat's published calls as fills, newest first, from `sinceSec` on: the copy-a-trader signal (A-3b, C8). On
 * Canton a trader's own fills are private to its lease (`wallet/*` answers 403 to anyone else, the runner included), so
 * a copier follows only what the trader chose to publish, which is what the studio promises ("their published calls").
 */
export function listPublishedFills(address: Address, query: { sinceSec?: number; limit?: number } = {}): Promise<Reading<LedgerFill[]>> {
  return withReading(`published-fills:${address}:${query.sinceSec ?? 0}`, async () => {
    const all = await indexRows<FillRow>(`published/${address}/fills`, { limit: query.limit ?? PAGE });
    const fills = query.sinceSec === undefined ? all : all.filter((f) => sec(f.ts_sec) >= query.sinceSec!);
    const rows = await marketRows([...new Set(fills.map((f) => f.market))]);
    return fills
      .map((fill) => {
        const row = rows.get(fill.market);
        return toLedgerFill(address, fill, row ? { lotBase: big(row.lot_base), tickBase: big(row.tick_base) } : undefined);
      })
      .filter((fill): fill is LedgerFill => fill !== null);
  });
}
