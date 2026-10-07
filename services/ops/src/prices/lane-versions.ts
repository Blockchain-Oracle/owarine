/**
 * Which original source each lane settles on, and from when (C6f). One table for everything that has to agree about it:
 * the bootstrap turns these into each Series' `PolicyVersion.printSource` texts, and halt-watch asks which of them is the
 * newest that covers now, so a lane is halted on the health of the signed price it really settles on and never on a
 * source that only the Solana-era reference used (a Pyth tick for a lane that settles on RedStone or Alpaca).
 *
 *   equity      a listed ticker's Regular and Gap lanes: the reference's dated versions in `price-sources.json`
 *               `tickers.<SYM>.versions` (Pyth trial, then RedStone), then the Canton-only `cantonVersions.tickers`
 *               (C6e, K-070: QQQ and VOO on Alpaca's last IEX trade)
 *   token       an xStock's 24/7 lane: the pinned Switchboard Surge version, then `cantonVersions.tokenLane` (C6e: the
 *               Jupiter Price v3 median)
 *   pre-IPO     the PreStocks catalogue read (D-100, D-101)
 *   basket      the basket index over one PreStocks read (S19)
 *   valuation   a Pyth valuation index (S20, D-125): only while a key is entitled to it
 *   crypto      the three exchanges' candle closes, which are not a `LaneVersion` at all (no dated table, no halt)
 *
 * Versions are appended, never edited: the newest one covering an instant is the source (`primarySourceAt`, the roller's
 * own rule, inclusive of `validUntil`).
 */
import { readFileSync } from "node:fs";
import { BASKET_TICKERS, PRE_IPO_TICKERS, TICKERS, type AttestedSource, type SourceVersion, type TickerSymbol, type XStockSymbol } from "@owarine/core/market";

export type LaneSource = Exclude<AttestedSource, "exchanges">;

/** One dated version of a lane's source: `primary` is the attested source (core `parsePrintSource`), `feed` its own feed name. */
export interface LaneVersion extends SourceVersion {
  primary: LaneSource;
  feed: string;
}

/** The parts of `price-sources.json` a lane's source depends on. */
export interface PriceSourcesFile {
  tickers: Record<string, { pythFeedId?: string; redstoneFeedId?: string; versions: Array<{ validFrom: string; validUntil: string | null; primary: "pyth" | "redstone" }> }>;
  tokenLane: { versions: Array<{ validFrom: string }>; tickers: Record<string, { surgeSymbol: string }> };
  /** C6e (K-070): Canton-only versions appended after a ticker's (Regular and Gap) and after the token lane's. */
  cantonVersions?: {
    tickers?: Record<string, Array<{ validFrom: string; validUntil: string | null; primary: "alpaca" }>>;
    tokenLane?: Array<{ validFrom: string; validUntil: string | null; primary: "jupiter" }>;
  };
}

const CONFIG_URL = new URL("../../config/price-sources.json", import.meta.url);
let cached: PriceSourcesFile | null = null;

/** `services/ops/config/price-sources.json`, read once per process. */
export function loadPriceSources(): PriceSourcesFile {
  cached ??= JSON.parse(readFileSync(CONFIG_URL, "utf8")) as PriceSourcesFile;
  return cached;
}

const isoSec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const untilSec = (iso: string | null) => (iso === null ? null : isoSec(iso));

/** D-100 (pre-IPO mints verified) and S19 (basket bases) dates: the attested PreStocks versions start there. */
export const PRESTOCKS_FROM_SEC = isoSec("2026-09-19T00:00:00Z");
export const BASKETS_FROM_SEC = isoSec("2026-09-22T00:00:00Z");
/** S20: the valuation lanes' Pyth index version. */
export const VALUATION_FROM_SEC = isoSec("2026-09-22T00:00:00Z");

/** A listed ticker's Regular and Gap versions, oldest first: the reference's (Pyth, RedStone), then the Canton-only ones. Empty for a ticker with no row. */
export function equityVersions(symbol: string, cfg: PriceSourcesFile = loadPriceSources()): LaneVersion[] {
  const row = cfg.tickers[symbol];
  if (!row) return [];
  const reference = row.versions.map((v): LaneVersion => ({
    validFromSec: isoSec(v.validFrom), validUntilSec: untilSec(v.validUntil), primary: v.primary, feed: (v.primary === "pyth" ? row.pythFeedId : row.redstoneFeedId)!,
  }));
  const canton = (cfg.cantonVersions?.tickers?.[symbol] ?? []).map((v): LaneVersion => ({ validFromSec: isoSec(v.validFrom), validUntilSec: untilSec(v.validUntil), primary: v.primary, feed: symbol }));
  return [...reference, ...canton];
}

/** An xStock's 24/7 versions, oldest first: the pinned Switchboard Surge feed, then the Canton-only Jupiter median (C6e). */
export function tokenLaneVersions(xstock: { symbol: XStockSymbol; surgeSymbol: string }, cfg: PriceSourcesFile = loadPriceSources()): LaneVersion[] {
  const surge: LaneVersion = { validFromSec: isoSec(cfg.tokenLane.versions[0]!.validFrom), validUntilSec: null, primary: "switchboard", feed: xstock.surgeSymbol };
  const canton = (cfg.cantonVersions?.tokenLane ?? []).map((v): LaneVersion => ({ validFromSec: isoSec(v.validFrom), validUntilSec: untilSec(v.validUntil), primary: v.primary, feed: xstock.symbol }));
  return [surge, ...canton];
}

export const preIpoVersions = (symbol: string): LaneVersion[] => [{ validFromSec: PRESTOCKS_FROM_SEC, validUntilSec: null, primary: "prestocks", feed: symbol }];
export const basketVersions = (symbol: string): LaneVersion[] => [{ validFromSec: BASKETS_FROM_SEC, validUntilSec: null, primary: "basket", feed: symbol }];
export const valuationVersions = (feedIdHex: string): LaneVersion[] => [{ validFromSec: VALUATION_FROM_SEC, validUntilSec: null, primary: "pyth-index", feed: feedIdHex.replace(/^0x/, "").toLowerCase() }];

/**
 * The versions of the lane a halt is keyed by (halts key a Regular or Gap lane by its ticker, a token lane by its xStock,
 * a pre-IPO name or basket by its own symbol). A crypto asset, a valuation lane (its Pyth index is the roller's
 * entitlement gate, not a halt) or a ticker with no row has none.
 */
export function laneVersionsOf(asset: TickerSymbol | XStockSymbol, cfg: PriceSourcesFile = loadPriceSources()): LaneVersion[] {
  const underlying = Object.values(TICKERS).find((t) => t.xstock?.symbol === asset);
  if (underlying) return tokenLaneVersions(underlying.xstock!, cfg);
  const ticker = TICKERS[asset as TickerSymbol];
  if (!ticker) return [];
  if (ticker.kind === "stock" || ticker.kind === "etf") return equityVersions(asset, cfg);
  if (ticker.kind === "preIpo") return PRE_IPO_TICKERS.includes(ticker.symbol) ? preIpoVersions(asset) : [];
  if (ticker.kind === "basket") return BASKET_TICKERS.includes(ticker.symbol) ? basketVersions(asset) : [];
  return [];
}
