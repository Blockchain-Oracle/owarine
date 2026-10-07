import { createHash } from "node:crypto";
import { encodeBase58 } from "@owarine/core/types";

/**
 * The venue's public facts as `/api/venue/*` answers them (`@owarine/markets` `venueFactsWire`, `marketFactsWire`), pure
 * over projection rows so the mapping is testable without a database. Ids follow core's ledger-id rule
 * (base58(sha256(domain ‖ text)), `@owarine/core/market` ledger-ids): deterministic from the venue party, the same on
 * every host, with no lookup table.
 */
export const VENUE_ID_DOMAIN = "agari/venue-id/v1:";
export const VENUE_CASH_DOMAIN = "agari/venue-cash/v1:";
/** Demo credits carry six decimals (`@owarine/markets/server` CASH_DECIMALS). */
export const CASH_DECIMALS = 6;
/** A winning side pays 10⁷ / 10⁷ (`PAYOUT_DENOMINATOR`). */
const PAYOUT_FULL = 10_000_000;

const digest = (domain: string, text: string): string => encodeBase58(new Uint8Array(createHash("sha256").update(domain + text, "utf8").digest()));

export const venueIdFromParty = (party: string): string => digest(VENUE_ID_DOMAIN, party);
export const venueCashIdFromParty = (party: string): string => digest(VENUE_CASH_DOMAIN, party);

/** `Source` as the read port numbers it: 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested (an ops oracle's own print). */
export function sourceOf(printSource: string | null | undefined): number {
  const s = (printSource ?? "").toLowerCase();
  if (s.startsWith("pyth")) return 1;
  if (s.startsWith("redstone")) return 2;
  if (s.startsWith("switchboard")) return 3;
  if (s.startsWith("attested")) return 4;
  return 0;
}

export interface SeriesRow {
  series: string;
  series_key: string;
  symbol: string | null;
  basis: number;
  cadence_sec: number;
  cash_unit: string;
  lot_base: string;
  tick_base: string;
  policy_versions: unknown;
}

/** A Series' policy sources, indexed by version (`toEventMarket` reads `policySources[policyVersion]`). */
export function policySources(versions: unknown): { primary: number; check: number }[] {
  const list = Array.isArray(versions) ? (versions as { version?: unknown; printSource?: unknown }[]) : [];
  const out: { primary: number; check: number }[] = [];
  for (const v of list) {
    const version = typeof v.version === "number" ? v.version : null;
    if (version === null || version < 0 || version > 255) continue;
    while (out.length <= version) out.push({ primary: 0, check: 0 });
    out[version] = { primary: sourceOf(typeof v.printSource === "string" ? v.printSource : null), check: 0 };
  }
  return out;
}

export function seriesFacts(row: SeriesRow) {
  return {
    address: row.series,
    seriesKey: row.series_key,
    symbol: row.symbol,
    basis: row.basis,
    cadenceSec: row.cadence_sec,
    lotBase: row.lot_base,
    tickBase: row.tick_base,
    cashUnit: row.cash_unit,
    // A leg is at least one lot; a seat posts no bond; a published ladder has no resting age or fill caps.
    minLots: "1",
    seatBond: "0",
    fillsCap: 0,
    evictionsCap: 0,
    minRestSlots: "0",
    policySources: policySources(row.policy_versions),
  };
}

/**
 * The venue itself. `mode` is the reference's code for ops' venue mode (C-DAML-02): 0 open, 1 reduce-only, 2 paused,
 * read from ops' `/session` (0 when ops cannot be read: the issuer itself still refuses new risk while held back). The
 * venue's quoting state per Window is what the ladder and the click-time quote say. No program seats trade here.
 */
export function venueFacts(venueParty: string, mode: 0 | 1 | 2 = 0) {
  const config = venueIdFromParty(venueParty);
  return { config, collateralMint: venueCashIdFromParty(venueParty), decimals: CASH_DECIMALS, treasury: config, mode, programSeats: [] as string[] };
}

export interface MarketRowForFacts {
  market: string;
  series: string | null;
  terms_cid: string;
  market_index: string;
  state: "open" | "resolved" | "voided";
  trading_start_sec: string;
  lock_at_sec: string;
  expiry_sec: string;
  backing_lots: string;
  winner: number | null;
}

/** One Window's `MarketData`: `book` is its terms contract (the ladder's key), `ledger` the Window id itself. */
export function marketFacts(row: MarketRowForFacts) {
  const state = row.state === "resolved" ? 1 : row.state === "voided" ? 2 : 0;
  return {
    address: row.market,
    data: {
      series: row.series ?? "",
      book: row.terms_cid,
      ledger: row.market,
      index: row.market_index,
      state,
      tradingStartSec: row.trading_start_sec,
      lockAtSec: row.lock_at_sec,
      expirySec: row.expiry_sec,
      backingLots: row.backing_lots,
      payoutYes: state === 1 && row.winner === 0 ? PAYOUT_FULL : 0,
      payoutNo: state === 1 && row.winner === 1 ? PAYOUT_FULL : 0,
    },
  };
}
