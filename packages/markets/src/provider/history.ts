/**
 * A wallet's settled history from the index (first-call.md §2.2; Masayume `provider/history.ts`): every fill on either
 * seat and every complete-set action, replayed into one ledger per Window and settled by the chain's rule. Whether a
 * payout reached the wallet is the index's `redeemed` flag (a user redeem or the settler's `redeem_for`).
 */
import { buildLedgers, ledgerHasActivity, roundSettledAtMs, settleRound, withReceipts, type LedgerFill, type LedgerSetAction, type LedgerSide, type MarketLedger, type SettledRound, type WalletHistory } from "@agari/core/projection";
import type { Reading } from "@agari/core/schemas";
import type { Address, Holdings, MarketId, Signature } from "@agari/core/types";
import { readVenueStatic } from "../runtime/accounts";
import { big, indexRows, sec, type ActionRow, type FillRow, type MarketRow, type PositionRow, type ReceiptRow } from "./index-api";
import { withReading } from "./reading";
import { outcomeOf, receiptFacts } from "./rows";

export const PAGE = 1_000;
const MAX_PAGES = 5;
/** The route caps `ids=` at 200 per request. */
const IDS_PER_REQUEST = 200;
const KIND: Record<number, LedgerSide> = { 0: "BUY_YES", 1: "SELL_YES", 2: "BUY_NO", 3: "SELL_NO" };

export interface WalletFillsQuery {
  /** The Book the fills executed on — a Window's `poolAddress`. Callers still filter on `marketId`: Books are recycled. */
  pool?: Address;
  /** Only fills at or after this unix second. */
  sinceSec?: number;
  limit?: number;
}

interface Grid {
  lotBase: bigint;
  tickBase: bigint;
}

export async function pageAll<T>(path: string): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await indexRows<T>(path, { limit: PAGE, offset: page * PAGE });
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** The wallet's own side of a fill; null when the Window's grid is unknown (its row isn't indexed yet). */
export function toLedgerFill(wallet: Address, fill: FillRow, grid: Grid | undefined): LedgerFill | null {
  const side = KIND[fill.taker === wallet ? fill.taker_kind : fill.maker_kind];
  if (!grid || !side) return null;
  return {
    marketId: fill.market as MarketId,
    side,
    quantityRaw: big(fill.lots) * grid.lotBase,
    yesPriceRaw: BigInt(fill.price_ticks) * grid.tickBase,
    // Canton charges the fee with the stake at the fill and returns it on a void (`PM.Leg`); history counts it as paid in.
    ...(fill.taker === wallet && fill.fee !== undefined && fill.fee !== null ? { feeBase: big(fill.fee) } : {}),
    atMs: sec(fill.ts_sec) * 1000,
    txHash: fill.signature as Signature,
  };
}

function toSetAction(action: ActionRow, grid: Grid | undefined): LedgerSetAction | null {
  if (action.name !== "CompleteSet" || !action.market || !grid) return null;
  const data = action.data as { minted?: boolean; lots?: string };
  return {
    marketId: action.market as MarketId,
    kind: data.minted ? "mint" : "merge",
    amountRaw: big(data.lots) * grid.lotBase,
    atMs: sec(action.block_time_sec) * 1000,
    txHash: action.signature as Signature,
  };
}

export async function marketRows(ids: readonly string[]): Promise<Map<string, MarketRow>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) chunks.push(ids.slice(i, i + IDS_PER_REQUEST));
  const pages = await Promise.all(chunks.map((chunk) => indexRows<MarketRow>("markets", { ids: chunk.join(",") })));
  return new Map(pages.flat().map((row) => [row.market, row]));
}

export async function listWalletHistory(wallet: Address): Promise<Reading<WalletHistory>> {
  return withReading(`history:${wallet}`, async () => {
    const [fills, actions, positions, receipts, venue] = await Promise.all([
      pageAll<FillRow>(`wallet/${wallet}/fills`),
      pageAll<ActionRow>(`wallet/${wallet}/actions`),
      indexRows<PositionRow>(`wallet/${wallet}/positions`, { limit: PAGE }),
      // 0.4.0 (K-028/K-030): the ledger's settlement receipts, pair legs and tickets, the history's ledger source.
      indexRows<ReceiptRow>(`wallet/${wallet}/receipts`, { limit: PAGE }),
      readVenueStatic(),
    ]);
    return (await replayHistory(wallet, { fills, actions, positions, receipts }, venue.decimals)).history;
  });
}

/** What a replay reads: paged fills and actions, the newest positions and receipts. */
export interface HistoryRows {
  fills: { rows: FillRow[]; complete: boolean };
  actions: { rows: ActionRow[]; complete: boolean };
  positions: PositionRow[];
  receipts: ReceiptRow[];
}

/** One ledger per Window a replay built, with the Window's row: the open ones are a profile's open calls. */
export interface ReplayedWindow {
  ledger: MarketLedger;
  row: MarketRow;
}

/**
 * The replay behind every history: fills and actions into one ledger per Window, settled by the chain's rule, with the
 * receipts attached. Shared by the seat's own history and (C13a) another seat's published record.
 */
export async function replayHistory(wallet: Address, input: HistoryRows, decimals: number): Promise<{ history: WalletHistory; open: ReplayedWindow[] }> {
  const { fills, actions, positions, receipts } = input;
  const venue = { decimals };
  const ids = [...new Set([...fills.rows.map((f) => f.market), ...actions.rows.flatMap((a) => (a.market ? [a.market] : []))])];
  const rows = await marketRows(ids);
  const grids = new Map([...rows].map(([id, row]) => [id, { lotBase: big(row.lot_base), tickBase: big(row.tick_base) }]));

  const own = fills.rows.map((fill) => toLedgerFill(wallet, fill, grids.get(fill.market)));
  const attributed = own.filter((fill): fill is LedgerFill => fill !== null);
  const sets = actions.rows.map((action) => toSetAction(action, grids.get(action.market ?? ""))).filter((a): a is LedgerSetAction => a !== null);
  const ledgers = buildLedgers(attributed, sets, venue.decimals);
  const redeemed = new Map(positions.map((p) => [p.market, p.redeemed]));
  const byCrank = new Map(positions.map((p) => [p.market, p.redeemed_by_crank]));

  const rounds: SettledRound[] = [];
  const open: ReplayedWindow[] = [];
  for (const [id, ledger] of ledgers) {
    const row = rows.get(id);
    // Drive-only Series (no registry symbol) never list, so they are no one's round either.
    if (!row || row.symbol === null || !ledgerHasActivity(ledger as MarketLedger)) continue;
    if (row.state === "open") {
      if (ledger.heldUpRaw + ledger.heldDownRaw > 0n) open.push({ ledger: ledger as MarketLedger, row });
      continue;
    }
    // A redeemed seat was paid (by the wallet or the settler's crank); an unredeemed one still holds its legs. A Window
    // past the newest PAGE positions has no row here, so whether it was paid is unread, never guessed as "to collect".
    const seat = redeemed.get(id);
    const live: Holdings | null = seat === undefined ? null : seat ? { upRaw: 0n, downRaw: 0n } : { upRaw: ledger.heldUpRaw, downRaw: ledger.heldDownRaw };
    const round = settleRound({
      ledger,
      market: {
        marketId: id,
        asset: row.symbol ?? "",
        intervalSec: row.cadence_sec ?? 0,
        expirySec: sec(row.expiry_sec),
        decimals: venue.decimals,
        settled: true,
        voided: row.state === "voided",
        winningOutcome: outcomeOf(row.winner),
        resolvedAtMs: row.resolved_ts_sec === null ? null : sec(row.resolved_ts_sec) * 1000,
      },
      feeBps: 0,
      liveHoldings: live,
    });
    if (round) rounds.push(round.claim === "paid" && byCrank.get(id) === true ? { ...round, paidByCrank: true } : round);
  }
  // Receipts attach to the rounds the fills built, and add the rounds only they know (tickets; legs with no fills).
  const all = withReceipts(rounds, receipts.map(receiptFacts), venue.decimals);
  all.sort((a, b) => roundSettledAtMs(b) - roundSettledAtMs(a));
  const history: WalletHistory = {
    rounds: all,
    openCount: open.length,
    fillCount: fills.rows.length,
    complete: fills.complete && actions.complete && attributed.length === own.length && receipts.length < PAGE,
    decimals: venue.decimals,
  };
  return { history, open };
}

/** A wallet's own fills, narrowed to one Book and a time. Empty means "not on the tape yet", never "nothing filled". */
export async function listWalletFills(wallet: Address, query: WalletFillsQuery = {}): Promise<Reading<LedgerFill[]>> {
  return withReading(`fills:${wallet}:${query.pool ?? "*"}:${query.sinceSec ?? 0}`, async () => {
    const fills = await indexRows<FillRow>(`wallet/${wallet}/fills`, { book: query.pool, since: query.sinceSec, limit: query.limit ?? 200 });
    const rows = await marketRows([...new Set(fills.map((f) => f.market))]);
    return fills
      .map((fill) => {
        const row = rows.get(fill.market);
        return toLedgerFill(wallet, fill, row ? { lotBase: big(row.lot_base), tickBase: big(row.tick_base) } : undefined);
      })
      .filter((fill): fill is LedgerFill => fill !== null);
  });
}
