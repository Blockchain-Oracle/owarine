/**
 * What halt-watch reads (session-lanes.md §3.1), each at the source's own pace, and only for a lane that settles on it
 * (C6f; `loadSourceVersions` names each asset's source from the same table the bootstrap registers the Series from):
 * - **RedStone** (the seven single names): the newest package time per feed, from the process's spot feed when price-relay
 *   runs (no extra gateway load), else its own `latest` read every 15 s (≈ 1.9 MB).
 * - **Alpaca** (QQQ, VOO): the newest IEX trade time, from the same spot feed (its 5 s poll of the same source the Windows
 *   print from), else its own `latest trades` read every 15 s (a few hundred bytes, the ops keys in headers only).
 * - **PreStocks** (the pre-IPO names and baskets): the newest catalogue read that priced each name or basket, from the
 *   process's PreStocks feed (a second catalogue reader would only add to its rate limit). No feed in the process, no read.
 * - **xStocks:** `system/status/<xStock>` every 60 s, keyless (1,000 calls/min allowed; this makes 4). Jupiter's own quote
 *   failures come from the xStock spot feed (`quote-failures.ts`).
 * - **Pyth:** Hermes `latest` (price, conf, publish time) once per pass in regular hours, for the feeds of lanes whose
 *   primary is Pyth. No lane's primary is Pyth today, so this makes no call. `PYTH_API_KEY` rides a Bearer header only.
 * A failed read keeps the last observation, so a source that stays unreadable ages into a stale halt on its own.
 */
import { BASKET_SYMBOLS, BASKETS, HALT_ASSETS, isTickerSymbol, PRE_IPO_TICKERS, XSTOCK_SYMBOLS, type HaltAsset, type PythTick, type SourceVersion, type TickerSymbol, type XStockSymbol } from "@agari/core/market";
import { indexOfSnapshot } from "../../prices/basket-index";
import { laneVersionsOf, loadPriceSources, type PriceSourcesFile } from "../../prices/lane-versions";
import type { PreStocksSnapshot } from "../../prices/prestocks-spot";
import type { SpotFeed } from "../../prices/spot";
import { ALPACA_DATA_URL } from "../../prices/attested-read";
import { alpacaLatestQuotes } from "../../prices/spot-feed";
import { HERMES, parsePythEntries } from "../price-relay/hermes-fetch";
import { fetchRedstoneLatest, latestMedian } from "../price-relay/redstone-fetch";
import type { RelaySources } from "../price-relay/sources";

const XSTOCKS_API = "https://api.xstocks.fi/api/v2/public";
const TIMEOUT_MS = 8_000;
export const REDSTONE_OWN_READ_MS = 15_000;
export const ALPACA_OWN_READ_MS = 15_000;
export const ISSUER_READ_MS = 60_000;

export interface AlpacaKeys {
  keyId: string;
  secretKey: string;
  dataUrl?: string;
}

/**
 * Each halt asset's dated versions, oldest first: the table `scripts/bootstrap` builds every Series' `printSource` from
 * (`lane-versions.ts`), so halt-watch and the roller can never disagree about which source a lane settles on. An asset
 * with no versions (crypto, SPY, a valuation lane) is absent: no source, so never halted.
 */
export function loadSourceVersions(cfg: PriceSourcesFile = loadPriceSources()): Partial<Record<HaltAsset, SourceVersion[]>> {
  return Object.fromEntries(HALT_ASSETS.map((asset) => [asset, laneVersionsOf(asset, cfg)] as const).filter(([, versions]) => versions.length > 0));
}

export interface SignalBook {
  pyth: Partial<Record<TickerSymbol, PythTick>>;
  redstoneNewestSec: Partial<Record<TickerSymbol, number>>;
  alpacaNewestSec: Partial<Record<TickerSymbol, number>>;
  prestocksNewestSec: Partial<Record<TickerSymbol, number>>;
  issuer: Partial<Record<XStockSymbol, boolean>>;
  /** Log-safe notes on failed reads this pass. */
  problems: string[];
}

export const emptySignals = (): SignalBook => ({ pyth: {}, redstoneNewestSec: {}, alpacaNewestSec: {}, prestocksNewestSec: {}, issuer: {}, problems: [] });

/** Hermes `latest` for the given feeds into `book.pyth`. Called with the feeds of Pyth-primary lanes only, so it is a no-op while there are none. */
export async function readPyth(book: SignalBook, feeds: RelaySources["pythFeeds"], key: string | undefined): Promise<void> {
  if (feeds.length === 0) return;
  if (!key) return void book.problems.push("pyth: no PYTH_API_KEY");
  const ids = feeds.map((f) => `ids[]=${f.feedIdHex}`).join("&");
  try {
    const res = await fetch(`${HERMES}/v2/updates/price/latest?${ids}&parsed=true`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return void book.problems.push(`pyth: Hermes HTTP ${res.status}`);
    const body = (await res.json()) as { parsed?: Parameters<typeof parsePythEntries>[0] };
    const bySymbol = new Map(feeds.map((f) => [f.feedIdHex, f.symbol]));
    for (const p of parsePythEntries(body.parsed ?? [])) {
      const symbol = bySymbol.get(p.feedIdHex);
      const prev = symbol ? book.pyth[symbol] : undefined;
      if (symbol && (!prev || p.publishTimeSec >= prev.publishTimeSec)) book.pyth[symbol] = { price: p.price, conf: p.conf, publishTimeSec: p.publishTimeSec };
    }
  } catch (error) {
    book.problems.push(`pyth: ${error instanceof Error ? error.name : "read failed"}`);
  }
}

/** Keeps `book.redstoneNewestSec` and `book.alpacaNewestSec` current from the spot feed's quotes; returns the unsubscribe. */
export function followSpot(book: SignalBook, spot: SpotFeed): () => void {
  return spot.subscribe((quote) => {
    // Only RedStone and Alpaca ticks of a ticker: a lane's halt reads the source it settles on, Pyth has its own read,
    // and xStock (Jupiter) quotes never halt a stock lane.
    if (!isTickerSymbol(quote.symbol)) return;
    if (quote.source === "redstone") book.redstoneNewestSec[quote.symbol] = Math.max(book.redstoneNewestSec[quote.symbol] ?? 0, quote.publishTimeSec);
    else if (quote.source === "alpaca") book.alpacaNewestSec[quote.symbol] = Math.max(book.alpacaNewestSec[quote.symbol] ?? 0, quote.publishTimeSec);
  });
}

/** One gateway `latest` read into `book.redstoneNewestSec` (used only without a spot feed). */
export async function readRedstone(book: SignalBook, sources: RelaySources): Promise<void> {
  try {
    const { text } = await fetchRedstoneLatest(sources.gateways);
    for (const { symbol, feed } of sources.redstoneFeeds) {
      const newest = latestMedian(text, feed, sources.redstoneSigners)?.publishTimeSec;
      if (newest !== undefined) book.redstoneNewestSec[symbol] = Math.max(book.redstoneNewestSec[symbol] ?? 0, newest);
    }
  } catch {
    book.problems.push("redstone: gateways failed");
  }
}

/** One Alpaca `latest trades` read (IEX) of `symbols` into `book.alpacaNewestSec` (used only without a spot feed). */
export async function readAlpaca(book: SignalBook, symbols: readonly TickerSymbol[], keys: AlpacaKeys | null): Promise<void> {
  if (symbols.length === 0) return;
  if (!keys) return void book.problems.push("alpaca: no ALPACA_KEY_ID / ALPACA_SECRET_KEY");
  try {
    const base = (keys.dataUrl ?? ALPACA_DATA_URL).replace(/\/+$/, "");
    const res = await fetch(`${base}/stocks/trades/latest?symbols=${symbols.join(",")}&feed=iex`, {
      headers: { "APCA-API-KEY-ID": keys.keyId, "APCA-API-SECRET-KEY": keys.secretKey }, signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return void book.problems.push(`alpaca: HTTP ${res.status}`);
    for (const quote of alpacaLatestQuotes(await res.text(), symbols)) {
      book.alpacaNewestSec[quote.symbol as TickerSymbol] = Math.max(book.alpacaNewestSec[quote.symbol as TickerSymbol] ?? 0, quote.publishTimeSec);
    }
  } catch (error) {
    book.problems.push(`alpaca: ${error instanceof Error ? error.name : "read failed"}`);
  }
}

/**
 * The newest PreStocks read that priced each pre-IPO name, and each basket (a basket only counts a read that priced every
 * member: the index is computed over one fetch). Pure over the feed's snapshots, oldest first; a name no read priced is absent.
 */
export function prestocksNewest(snapshots: readonly PreStocksSnapshot[]): Partial<Record<TickerSymbol, number>> {
  const out: Partial<Record<TickerSymbol, number>> = {};
  const newest = (priced: (snapshot: PreStocksSnapshot) => boolean): number | undefined => {
    for (let i = snapshots.length - 1; i >= 0; i--) if (priced(snapshots[i]!)) return snapshots[i]!.fetchedAtSec;
    return undefined;
  };
  for (const name of PRE_IPO_TICKERS) {
    const sec = newest((s) => s.samples.has(name));
    if (sec !== undefined) out[name] = sec;
  }
  for (const basket of BASKET_SYMBOLS) {
    const sec = newest((s) => indexOfSnapshot(BASKETS[basket], s) !== null);
    if (sec !== undefined) out[basket] = sec;
  }
  return out;
}

/** xStocks' own trading-halt flag for each token-lane xStock into `book.issuer`. */
export async function readIssuer(book: SignalBook): Promise<void> {
  await Promise.all(
    XSTOCK_SYMBOLS.map(async (xstock) => {
      try {
        const res = await fetch(`${XSTOCKS_API}/system/status/${xstock}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const body = res.ok ? ((await res.json()) as { symbol?: unknown; isMarketTradingHalted?: unknown }) : null;
        if (body?.symbol === xstock && typeof body.isMarketTradingHalted === "boolean") book.issuer[xstock] = body.isMarketTradingHalted;
        else book.problems.push(`issuer ${xstock}: ${res.ok ? "unexpected body" : `HTTP ${res.status}`}`);
      } catch (error) {
        book.problems.push(`issuer ${xstock}: ${error instanceof Error ? error.name : "read failed"}`);
      }
    }),
  );
}
