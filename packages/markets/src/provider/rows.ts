/**
 * Index rows → port shapes (first-call.md §2.3). The chain facts an index row lacks come from the caller: collateral
 * and decimals from `readVenue`, and a not-yet-printed Window's primary source from its Series policy.
 */
import type { SettledMarket } from "@agari/core/claims";
import type { ReceiptFacts, RoundMarket } from "@agari/core/projection";
import { isEventKey, isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import type { Address, EventMarket, IndexedStatus, LaneBasis, MarketId, OutcomeIdx, PrintSource, Resolution, Signature, VoidReason } from "@agari/core/types";
import type { SeriesFacts, VenueFacts } from "../runtime/accounts";
import { big, bigOrNull, sec, type MarketRow, type PositionRow, type ReceiptRow } from "./index-api";

const BASIS: Record<number, LaneBasis> = { 0: "regular", 1: "gap", 2: "token" };
const SOURCE: Record<number, PrintSource> = { 1: "pyth", 2: "redstone", 3: "switchboard", 4: "attested" };
const VOID_REASON: Record<number, VoidReason> = { 1: "missing-print", 2: "cross-check-divergence" };
export const PRINT = { open: "0", close: "1" } as const;

export const sourceName = (source: number | null | undefined): PrintSource | null => (source ? (SOURCE[source] ?? null) : null);

/** The index's time-derived status (events-engine.md §7 over the row); `Settling` and `Finalized` are never emitted. */
export function indexedStatus(state: MarketRow["state"], tradingStartSec: number, lockAtSec: number, nowSec: number): IndexedStatus {
  if (state === "resolved") return "Resolved";
  if (state === "voided") return "Voided";
  if (nowSec < tradingStartSec) return "Listed";
  return nowSec < lockAtSec ? "Trading" : "Locked";
}

export const outcomeOf = (winner: number | null): OutcomeIdx | null => (winner === 0 || winner === 1 ? winner : null);

/** Rows of registry tickers on a known lane: the drive-only Series 900 (no symbol) never lists. */
export const isListable = (row: MarketRow): boolean => row.symbol !== null && isTickerSymbol(row.symbol) && row.basis !== null && row.basis in BASIS && row.book !== null;

/**
 * C6e (K-070): a committee event's row (`EVT-…` Series listed by `Series_OpenEvent`). It lists beside the lanes, never in
 * them; its `asset` is the Series key and its lane reads 24/7 ("token"): an event trades until its lock whatever the
 * NYSE session, and the ticket's lane guard must not hold it to Regular hours.
 */
export const isEventRow = (row: MarketRow): boolean => row.symbol !== null && isEventKey(row.symbol) && row.book !== null;

export function toEventMarket(row: MarketRow, venue: VenueFacts, series: SeriesFacts | null, nowSec: number): EventMarket {
  const tradingStartSec = sec(row.trading_start_sec);
  const lockAtSec = sec(row.lock_at_sec);
  const expirySec = sec(row.expiry_sec);
  const open = row.prints?.[PRINT.open] ?? null;
  const policy = row.policy_version ?? 0;
  // Never a guess: a Series whose policy could not be read names no source until it can.
  const primary = sourceName(open?.source) ?? sourceName(series?.policySources[policy]?.primary);
  const asset = row.symbol as TickerSymbol;
  const cashUnit = big(row.cash_unit);
  return {
    marketId: row.market as MarketId,
    kind: isEventRow(row) ? "event" : "price",
    venueId: venue.config as string as Address,
    asset,
    lane: isEventRow(row) ? "token" : (BASIS[row.basis ?? 0] ?? "regular"),
    // 0.4.0: a committee event asks its own question (`EventTerms`); a price Window asks the lane's.
    question: row.event_question ?? `Will ${asset} close at or above its opening print?`,
    intervalSec: row.cadence_sec ?? 0,
    tradingStartSec,
    lockAtSec,
    expirySec,
    poolAddress: row.book as Address,
    marketAddress: row.market as Address,
    seriesAddress: row.series as Address,
    nonce: bigOrNull(row.market_index),
    policyVersion: policy,
    printSource: primary,
    printSourceText: row.print_source ?? null,
    collateral: venue.collateralMint as string as Address,
    decimals: venue.decimals,
    status: indexedStatus(row.state, tradingStartSec, lockAtSec, nowSec),
    winningOutcome: outcomeOf(row.winner),
    voided: row.state === "voided",
    voidReason: row.void_reason ? (VOID_REASON[row.void_reason] ?? null) : null,
    finalized: row.state !== "open",
    openingPriceRaw: open ? BigInt(open.price) : null,
    volumeQuoteRaw: big(row.volume_ticklots) * cashUnit,
    tradeCount: sec(row.trade_count),
    lastPriceRaw: row.last_price_ticks === null ? null : BigInt(row.last_price_ticks) * big(row.tick_base),
    resolvedAtMs: row.resolved_ts_sec === null ? null : sec(row.resolved_ts_sec) * 1000,
  };
}

export function toResolution(row: MarketRow | null): Resolution {
  const open = row?.prints?.[PRINT.open] ?? null;
  const close = row?.prints?.[PRINT.close] ?? null;
  const terminal = row !== null && row.state !== "open";
  return {
    openingRaw: open ? BigInt(open.price) : null,
    closingRaw: close ? BigInt(close.price) : null,
    settlementTxHash: terminal ? ((row.resolved_signature as Signature | null) ?? null) : null,
    printSource: sourceName(close?.source),
    printSourceText: row?.print_source ?? null,
    singleSource: row?.single_source === true,
    settledAtMs: terminal && row.resolved_ts_sec !== null ? sec(row.resolved_ts_sec) * 1000 : null,
    voided: row?.state === "voided",
    voidReason: row?.void_reason ? (VOID_REASON[row.void_reason] ?? null) : null,
  };
}

/** A position row carries its Window's settlement facts: enough for claims and settled rounds without a market read. */
export function positionMarket(row: PositionRow, decimals: number): SettledMarket & RoundMarket {
  return {
    marketId: row.market as MarketId,
    marketAddress: row.market as Address,
    asset: (row.symbol ?? "") as TickerSymbol,
    intervalSec: row.cadence_sec ?? 0,
    expirySec: sec(row.expiry_sec),
    decimals,
    settled: row.state !== "open",
    voided: row.state === "voided",
    winningOutcome: outcomeOf(row.winner),
    resolvedAtMs: row.resolved_ts_sec === null ? null : sec(row.resolved_ts_sec) * 1000,
  };
}

/** What a seat held at settlement, from the index: bought − sold + minted − merged per side (a Redeemed zeroes lots). */
export function heldAtSettlement(row: PositionRow): { upLots: bigint; downLots: bigint } {
  const sets = big(row.minted_lots) - big(row.merged_lots);
  return {
    upLots: big(row.bought_yes_lots) - big(row.sold_yes_lots) + sets,
    downLots: big(row.bought_no_lots) - big(row.sold_no_lots) + sets,
  };
}

/** A receipt row as the history projection reads it (core `withReceipts`). */
export function receiptFacts(row: ReceiptRow): ReceiptFacts {
  const side = (v: number | null): OutcomeIdx | null => (v === 0 || v === 1 ? v : null);
  return {
    receiptId: row.receipt_cid,
    marketId: row.market as MarketId,
    product: row.product,
    outcomeIdx: side(row.outcome) ?? 0,
    resolvedIdx: side(row.resolved),
    lots: big(row.lots),
    cashUnit: big(row.cash_unit),
    costBase: big(row.cost),
    payoutBase: big(row.payout),
    feeBase: big(row.fee),
    detail: row.detail
      ? { reserveId: row.detail.reserveId, marketIds: row.detail.marketIds, pick: row.detail.pick, stakeBase: big(row.detail.stake), toReserveBase: big(row.detail.toReserve), result: row.detail.result }
      : null,
    atMs: sec(row.ts_sec) * 1000,
    txHash: row.signature as Signature,
    market: {
      asset: row.symbol ?? row.market_key.split(":")[0] ?? "",
      intervalSec: row.cadence_sec ?? 0,
      expirySec: sec(row.expiry_sec),
      resolvedAtMs: row.resolved_ts_sec === null ? null : sec(row.resolved_ts_sec) * 1000,
      question: row.event_question,
    },
  };
}
