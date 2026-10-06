/**
 * The one line that names where a price comes from, beside the price (S25): "Settles on Pyth · TSLA/USD", "Settles on
 * RedStone · NVDA/USD", "Prices from PreStocks · mint Prew…rpgF", "Index of 2 PreStocks prices". Pure, so the hero, the
 * hubs and the tests say the same thing.
 *
 * The source is read, never assumed. A Window carries its Series policy's primary source (`EventMarket.printSource`, the
 * opening print's source once recorded), so when a policy version changes source the next Window's line follows it with
 * no edit here. A pre-IPO name and a basket are PreStocks by construction (D-100, D-124), so their line is the registry's.
 * A source that the ticker cannot have (Pyth on a name with no Pyth feed, Switchboard off the token lane), or no source at
 * all (a Series whose policy was not read), yields no line rather than a wrong one.
 *
 * On Canton (C-S25, C10f) every print is attested: the venue's oracle parties read the original source and sign what they
 * read on the ledger. So an attested Window's line names that source from its policy text and says where it was signed
 * ("Settles on RedStone · NVDA/USD · signed on Canton"), and a PreStocks line no longer shows a token mint, which lives
 * on another network.
 */
import { basketOf, parsePrintSource, TICKERS, type AttestedSource, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneSet, PrintSource } from "@agari/core/types";

export type SourceProvider = "pyth" | "redstone" | "switchboard" | "prestocks" | "exchanges" | "alpaca" | "jupiter";

export interface SourceLabel {
  provider: SourceProvider;
  /** "Settles on Pyth · TSLA/USD" */
  text: string;
  /** The feed's own page (Pyth Terminal); null where no public page is pinned. */
  href: string | null;
}

/** Pyth Terminal's feed page; `/` is `%2F` (`Equity.US.TSLA%2FUSD`), the form Pyth's own links use. */
export const pythFeedUrl = (pythSymbol: string): string => `https://app.pyth.com/explore/${encodeURIComponent(pythSymbol)}`;

export const SOURCE_COPY = {
  settles: (provider: string, feed: string) => `Settles on ${provider} · ${feed}`,
  /** An attested print: the source the oracle parties read, then where they signed it. */
  attested: (provider: string, feed: string) => `Settles on ${provider} · ${feed} · signed on Canton`,
  preIpo: "Prices from PreStocks · signed on Canton",
  basket: (count: number) => `Index of ${count} PreStocks prices · signed on Canton`,
} as const;

/** The attested sources a price line can name, with the name it goes by; a committee's event attestation is not a price. */
const ATTESTED_LINE: Partial<Record<AttestedSource, { provider: SourceProvider; name: string }>> = {
  exchanges: { provider: "exchanges", name: "Coinbase, Kraken and Bitstamp" },
  redstone: { provider: "redstone", name: "RedStone" },
  alpaca: { provider: "alpaca", name: "Alpaca IEX" },
  jupiter: { provider: "jupiter", name: "Jupiter Price v3" },
  pyth: { provider: "pyth", name: "Pyth" },
  switchboard: { provider: "switchboard", name: "Switchboard" },
};

/** The registry's own line for an asset whose source is fixed by what it is: a pre-IPO name, a basket or a valuation lane. */
function kindLabel(asset: TickerSymbol): SourceLabel | null {
  const ticker = (TICKERS as Partial<Record<string, (typeof TICKERS)[TickerSymbol]>>)[asset];
  if (!ticker) return null;
  const basket = basketOf(asset);
  if (basket) return { provider: "prestocks", text: SOURCE_COPY.basket(basket.members.length), href: null };
  if (ticker.kind === "preIpo" && ticker.preIpo) return { provider: "prestocks", text: SOURCE_COPY.preIpo, href: null };
  if (ticker.kind === "valuation" && ticker.valuationOf && ticker.pythIndexFeedId) {
    const feed = `Equity.Index.${ticker.valuationOf}/USD`;
    return { provider: "pyth", text: SOURCE_COPY.settles("Pyth", `${ticker.valuationOf}/USD index`), href: pythFeedUrl(feed) };
  }
  return null;
}

/** An exchange-listed name's line for one signed source, or null when the ticker has no feed on it. */
function listedLabel(asset: TickerSymbol, source: PrintSource | null, lane: EventMarket["lane"]): SourceLabel | null {
  if (source === null) return null;
  const ticker = (TICKERS as Partial<Record<string, (typeof TICKERS)[TickerSymbol]>>)[asset];
  if (!ticker) return null;
  const pair = `${asset}/USD`;
  // The token lane prices the xStock; the Regular and Gap lanes price the stock's own print.
  if (lane === "token") {
    return source === "switchboard" && ticker.xstock ? { provider: "switchboard", text: SOURCE_COPY.settles("Switchboard", ticker.xstock.symbol), href: null } : null;
  }
  if (source === "pyth" && ticker.pythFeedId) return { provider: "pyth", text: SOURCE_COPY.settles("Pyth", pair), href: pythFeedUrl(`Equity.US.${pair}`) };
  if (source === "redstone" && ticker.redstoneFeedId) return { provider: "redstone", text: SOURCE_COPY.settles("RedStone", pair), href: null };
  return null;
}

/**
 * An attested Window's line from its policy text: the source the oracle parties read and the feed, as "BTC/USD" for a
 * pair or the token's own symbol (`TSLAx`) on the token lane. Null when the text is absent or names no price source.
 */
function attestedLabel(asset: TickerSymbol, text: string | null | undefined): SourceLabel | null {
  const parts = text ? parsePrintSource(text) : null;
  const line = parts ? ATTESTED_LINE[parts.source] : undefined;
  if (!parts || !line) return null;
  const feed = parts.source === "jupiter" && parts.feed ? parts.feed : `${asset}/USD`;
  return { provider: line.provider, text: SOURCE_COPY.attested(line.name, feed), href: null };
}

/** The line for one Window, from its policy's primary source (and, on Canton, the policy text naming what was attested). */
export function windowSourceLabel(market: Pick<EventMarket, "asset" | "lane" | "printSource" | "printSourceText">): SourceLabel | null {
  return kindLabel(market.asset) ?? attestedLabel(market.asset, market.printSourceText) ?? listedLabel(market.asset, market.printSource, market.lane);
}

/**
 * The line for an asset with no Window in view (the closed hero, a ticker hub): the registry's for a pre-IPO name or a
 * basket, else the newest listed stock-price Window's (Regular or Gap) for this asset. Null when no such Window is
 * listed: an asset between lanes names no source rather than guess one.
 */
export function assetSourceLabel(asset: TickerSymbol, laneSet: Pick<LaneSet, "lanes"> | null): SourceLabel | null {
  const fixed = kindLabel(asset);
  if (fixed) return fixed;
  let newest: EventMarket | null = null;
  for (const lane of laneSet?.lanes ?? []) {
    if (lane.basis === "token") continue;
    for (const market of lane.markets) {
      if (market.asset === asset && (newest === null || market.tradingStartSec > newest.tradingStartSec)) newest = market;
    }
  }
  return newest ? windowSourceLabel(newest) : null;
}

/** A pre-IPO name or a basket: priced from the PreStocks catalogue and attested by the venue (D-100, D-124). */
export function isPreStocksAsset(asset: string | null): boolean {
  if (asset === null || !(asset in TICKERS)) return false;
  const kind = TICKERS[asset as TickerSymbol].kind;
  return kind === "preIpo" || kind === "basket";
}

const PRINT_SOURCE_NAME: Record<Exclude<PrintSource, "attested">, string> = { pyth: "Pyth", redstone: "RedStone", switchboard: "Switchboard" };

/**
 * An attested print's original source, as a verdict names it: the source its Window's policy `printSource` text reads
 * (core `parsePrintSource`), so a lane whose policy changes source is named by the new one with no edit here. A basket's
 * index is PreStocks' prices, so it goes by PreStocks too.
 */
export const ATTESTED_SOURCE_NAME: Record<AttestedSource, string> = {
  exchanges: "Coinbase/Kraken/Bitstamp quorum",
  redstone: "RedStone",
  pyth: "Pyth",
  switchboard: "Switchboard",
  prestocks: "PreStocks",
  basket: "PreStocks",
  "pyth-index": "Pyth index",
  committee: "Oracle committee",
  alpaca: "Alpaca IEX",
  jupiter: "Jupiter Price v3 median",
};

/** An attested print whose Window's policy text was not read: what it is, never a guessed source. */
export const ATTESTED_UNNAMED = "Oracle-attested";

/**
 * The name a recorded print's source goes by on every surface (the proof page, the verdict, the share card). On Canton
 * every print is attested by the oracle parties, and the Window's policy `printSource` text names the original source
 * (Coinbase, Kraken and Bitstamp for crypto, RedStone or Alpaca IEX for stocks, the Jupiter Price v3 median for xStocks,
 * PreStocks for pre-IPO names and baskets). Without that text a PreStocks asset is still PreStocks by construction
 * (D-100, D-124); anything else says only that the oracle parties attested it.
 */
export function printSourceName(source: PrintSource, asset: string | null, printSourceText?: string | null): string {
  if (source !== "attested") return PRINT_SOURCE_NAME[source];
  const parts = printSourceText ? parsePrintSource(printSourceText) : null;
  if (parts) return ATTESTED_SOURCE_NAME[parts.source];
  return isPreStocksAsset(asset) ? "PreStocks" : ATTESTED_UNNAMED;
}
