/**
 * One oracle party's off-chain read of a lane's original source at a boundary T (C6, plan "Prices and lanes"). The
 * reference relay posted these values to Solana as Pyth, RedStone, Switchboard and attested prints; on Canton each
 * oracle party reads the same source itself and posts a `PriceQuote` naming it (`attested:<source>:<feed>`). The
 * reading rules are the reference's:
 *
 *   redstone     the gateway's historical packages at exactly T, configured signers only, ≥ threshold (3 of 5), median
 *   pyth         Hermes `/v2/updates/price/{T}` with `PYTH_API_KEY`; the first update within `graceSec` of T
 *   pyth-index   the same, only while the key is entitled to the index (S20, D-125)
 *   switchboard  a Surge simulation of the xStock's pinned feed hash inside `[T + 10, T + 60]`
 *   prestocks    the first PreStocks catalogue read inside `[T + 10, T + 45]` (D-100/D-101 `chooseSample`)
 *   basket       the first complete catalogue read inside that window, as the basket's index (S19)
 *   alpaca       (C6e, K-070) Alpaca market data: the last IEX trade in `[T − 300, T]`, read from T + 5 with the ops keys
 *   jupiter      (C6e, K-070) the median of the process's Jupiter Price v3 samples at T − 40, T − 20 and T (each the newest
 *                in the 5 s before its point), the reference's `jupiter-attest.ts` token-lane fallback
 *
 * Nothing is clamped or guessed: a read that cannot be made inside its window is `missed`, and the Window voids on a
 * missing print. The payload is the exact response text where the source has one (RedStone's feed array, Hermes and
 * the crossbar bodies); a PreStocks read keeps no body, so its payload is the sample the process holds, as JSON.
 */
import { BASKETS, isTickerSymbol, XSTOCK_SYMBOLS, type AttestedSource, type BasketSymbol, type PrintSourceParts, type XStockSymbol } from "@owarine/core/market";
import { decimalToE8, JUPITER_SAMPLE_OFFSETS_SEC, medianE8 } from "@owarine/markets/ops/prints";
import { fetchPythAt } from "../actors/price-relay/hermes-fetch";
import { choosePrint } from "../actors/price-relay/prestocks-pass";
import { feedAt, fetchRedstoneAt } from "../actors/price-relay/redstone-fetch";
import type { RelaySources } from "../actors/price-relay/sources";
import type { PythEntitlementStore } from "../runtime/pyth-entitlement";
import type { PreStocksSpotFeed } from "./prestocks-spot";
import type { XStockSpotFeed } from "./xstock-spot";

export const SWITCHBOARD_CROSSBAR = "https://crossbar.switchboard.xyz";
/** The relay fetched RedStone at T + 10 (`REDSTONE_FETCH_AFTER_SEC`); a thin boundary is retried until T + this. */
export const REDSTONE_THIN_UNTIL_SEC = 120;
const SWITCHBOARD_WINDOW_SEC = 60;
const PYTH_GRACE_SEC = { pyth: 5, "pyth-index": 60 } as const;
/** Alpaca market data (the free plan's real-time feed is IEX). */
export const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";
/** An IEX trade older than this before T is not T's price (a quiet ETF still trades on IEX every few seconds in session). */
export const ALPACA_MAX_STALE_SEC = 300;
/** A Jupiter sample counts for a point when taken in the 5 s before it (`jupiter-attest.ts` `barMedianE8`). */
const JUPITER_SAMPLE_WINDOW_SEC = 5;

export interface AttestedRead {
  priceE8: bigint;
  /** When the value was read (the quote's `fetchedAt`); never before T. */
  fetchedAtSec: number;
  payload: string;
  /** How many independent signers stand behind the value (RedStone packages; 1 otherwise). */
  signers: number;
  note: string;
}

export type ReadOutcome = { kind: "ok"; read: AttestedRead } | { kind: "wait"; why: string; retrySec: number } | { kind: "missed"; why: string };

export interface ReadSlot {
  boundarySec: number;
  earliestSec: number;
  deadlineSec: number;
}

export interface AttestedReaderDeps {
  sources: Pick<RelaySources, "gateways" | "redstoneSigners" | "redstoneThreshold">;
  pythKey?: string;
  pythIndex?: Pick<PythEntitlementStore, "usable"> | null;
  /** Surge symbol (`TSLAX/USD`) → pinned feed hash (price-sources.json `tokenLane`). */
  switchboardFeeds: ReadonlyMap<string, string>;
  prestocks: () => Pick<PreStocksSpotFeed, "history" | "snapshots"> | null;
  /** C6e: Alpaca market-data keys (the calendar's `ALPACA_KEY_ID` / `ALPACA_SECRET_KEY`); absent = the source cannot sign. */
  alpaca?: { keyId: string; secretKey: string; dataUrl?: string } | null;
  /** C6e: the process's Jupiter xStock samples (`xstock-spot`); null while no feed runs. */
  xstock?: () => Pick<XStockSpotFeed, "at"> | null;
  fetchImpl?: typeof fetch;
}

export interface AttestedReader {
  read(parts: PrintSourceParts, slot: ReadSlot, nowSec: number): Promise<ReadOutcome>;
}

const wait = (why: string, retrySec: number): ReadOutcome => ({ kind: "wait", why, retrySec });

/** A crossbar simulate body → its first numeric result, or why not. Pure. */
export function surgeValueOf(text: string): { value: string } | { error: string } {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: `crossbar: ${text.slice(0, 80)}` };
  }
  const first = Array.isArray(body) ? (body[0] as { results?: unknown[] | null; error?: string } | undefined) : undefined;
  const result = first?.results?.[0];
  if (typeof result === "number" && Number.isFinite(result) && result > 0) return { value: result.toFixed(8) };
  if (typeof result === "string" && /^\d+(\.\d+)?$/.test(result)) return { value: result };
  return { error: first?.error ? `crossbar: ${first.error.slice(0, 120)}` : "crossbar returned no result" };
}

/** An Alpaca `/stocks/{symbol}/trades` body → the newest trade at or before T inside the staleness bound, or why not. Pure. */
export function alpacaTradeAt(text: string, tSec: number): { price: string; atSec: number } | { error: string } {
  let body: { trades?: Array<{ p?: unknown; t?: unknown }> | null };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return { error: `Alpaca: ${text.slice(0, 80)}` };
  }
  const trade = (body.trades ?? []).find((x) => typeof x.t === "string" && Date.parse(x.t) / 1000 <= tSec);
  if (!trade) return { error: `no IEX trade in [T − ${ALPACA_MAX_STALE_SEC} s, T]` };
  const atSec = Math.floor(Date.parse(trade.t as string) / 1000);
  if (typeof trade.p !== "number" || !Number.isFinite(trade.p) || trade.p <= 0) return { error: "Alpaca trade without a price" };
  if (atSec < tSec - ALPACA_MAX_STALE_SEC) return { error: `the last IEX trade was ${tSec - atSec} s before T` };
  return { price: trade.p.toFixed(8), atSec };
}

/** The Jupiter bar median of `xstock` at T from the sampled feed (`jupiter-attest.ts` `barMedianE8`), or the missing points. Pure. */
export function jupiterBarAt(feed: Pick<XStockSpotFeed, "at">, xstock: XStockSymbol, tSec: number): { medianE8: bigint; samples: Array<{ offsetSec: number; sampledSec: number; priceE8: string }> } | { missing: string } {
  const samples = JUPITER_SAMPLE_OFFSETS_SEC.map((offset) => feed.at(xstock, tSec + offset, JUPITER_SAMPLE_WINDOW_SEC));
  const gaps = JUPITER_SAMPLE_OFFSETS_SEC.filter((_, i) => !samples[i]);
  if (gaps.length) return { missing: `${xstock} Jupiter sample missing at ${gaps.map((g) => (g ? `T${g}` : "T")).join(", ")}` };
  return {
    medianE8: medianE8(samples.map((q) => q!.priceE8)),
    samples: samples.map((q, i) => ({ offsetSec: JUPITER_SAMPLE_OFFSETS_SEC[i]!, sampledSec: q!.sampledSec, priceE8: q!.priceE8.toString() })),
  };
}

export function createAttestedReader(deps: AttestedReaderDeps): AttestedReader {
  const fetchImpl = deps.fetchImpl ?? fetch;
  // One boundary's gateway body per reader: every RedStone lane at T reads the same ~1.9 MB response.
  let redstone: { tSec: number; text: string; atSec: number } | null = null;

  async function readRedstone(feed: string, slot: ReadSlot, nowSec: number): Promise<ReadOutcome> {
    const t = slot.boundarySec;
    if (nowSec < t + 10) return wait("RedStone is read from T + 10 s", t + 10);
    const measure = () => feedAt(redstone!.text, feed, t, deps.sources.redstoneSigners);
    if (!redstone || redstone.tSec !== t) redstone = { tSec: t, text: (await fetchRedstoneAt(t, deps.sources.gateways)).text, atSec: nowSec };
    let at = measure();
    // A thin boundary may still fill in: re-read the gateway (at most every 5 s) until T + 120 s.
    if ((at?.packages.length ?? 0) < deps.sources.redstoneThreshold && nowSec - redstone.atSec >= 5 && nowSec <= t + REDSTONE_THIN_UNTIL_SEC) {
      redstone = { tSec: t, text: (await fetchRedstoneAt(t, deps.sources.gateways)).text, atSec: nowSec };
      at = measure();
    }
    const signers = at?.packages.length ?? 0;
    if (!at || at.medianE8 === null || signers < deps.sources.redstoneThreshold) {
      const why = `RedStone ${feed} @T has ${signers} of ${deps.sources.redstoneThreshold} signers`;
      return nowSec <= t + REDSTONE_THIN_UNTIL_SEC ? wait(why, nowSec + 5) : { kind: "missed", why };
    }
    return { kind: "ok", read: { priceE8: at.medianE8, fetchedAtSec: nowSec, payload: at.json, signers, note: `RedStone ${feed} median of ${signers}` } };
  }

  async function readPyth(source: "pyth" | "pyth-index", feedIdHex: string, slot: ReadSlot, nowSec: number): Promise<ReadOutcome> {
    if (!deps.pythKey) return { kind: "missed", why: "PYTH_API_KEY is not set (Hermes answers 401)" };
    if (source === "pyth-index" && !deps.pythIndex?.usable(feedIdHex)) return { kind: "missed", why: "Pyth feed not entitled" };
    const t = slot.boundarySec;
    const r = await fetchPythAt(t, [feedIdHex], deps.pythKey);
    if (!r.ok) {
      const why = r.authFailed ? `Hermes refused the key (HTTP ${r.status})` : `Hermes HTTP ${r.status || "error"}`;
      return r.authFailed || nowSec > slot.deadlineSec - 5 ? { kind: "missed", why } : wait(why, nowSec + 3);
    }
    const p = r.boundary.parsed.find((x) => x.feedIdHex === feedIdHex);
    if (!p || p.publishTimeSec < t || p.publishTimeSec > t + PYTH_GRACE_SEC[source]) return { kind: "missed", why: `no Pyth update within ${PYTH_GRACE_SEC[source]} s of T` };
    return { kind: "ok", read: { priceE8: p.priceE8, fetchedAtSec: Math.max(t, Math.floor(r.boundary.fetchedAtMs / 1000)), payload: r.boundary.text, signers: 1, note: `Pyth ${feedIdHex.slice(0, 8)}… published ${p.publishTimeSec}` } };
  }

  async function readSwitchboard(surge: string, slot: ReadSlot, nowSec: number): Promise<ReadOutcome> {
    const t = slot.boundarySec;
    const feedHash = deps.switchboardFeeds.get(surge);
    if (!feedHash) return { kind: "missed", why: `no pinned Switchboard feed for ${surge}` };
    if (nowSec < t + 10) return wait("Switchboard is read inside [T + 10, T + 60]", t + 10);
    if (nowSec > t + SWITCHBOARD_WINDOW_SEC) return { kind: "missed", why: "past T + 60 s" };
    const res = await fetchImpl(`${SWITCHBOARD_CROSSBAR}/simulate/${feedHash}`, { signal: AbortSignal.timeout(8_000) });
    const text = await res.text();
    const v = res.ok ? surgeValueOf(text) : { error: `crossbar HTTP ${res.status}` };
    if ("error" in v) return wait(v.error, nowSec + 5);
    return { kind: "ok", read: { priceE8: decimalToE8(v.value), fetchedAtSec: nowSec, payload: text, signers: 1, note: `Switchboard ${surge}` } };
  }

  function readPreStocks(source: "prestocks" | "basket", feed: string, slot: ReadSlot, nowSec: number): ReadOutcome {
    const book = deps.prestocks();
    if (!book) return { kind: "missed", why: "no PreStocks feed running" };
    const target = source === "basket"
      ? feed in BASKETS ? { kind: "basket" as const, basket: BASKETS[feed as BasketSymbol] } : null
      : isTickerSymbol(feed) ? { kind: "name" as const, symbol: feed } : null;
    if (!target) return { kind: "missed", why: `${feed} is not a PreStocks ${source === "basket" ? "basket" : "name"}` };
    const chosen = choosePrint(book, target, { boundarySec: slot.boundarySec, earliestSec: slot.earliestSec }, nowSec);
    if ("waiting" in chosen) return wait(chosen.waiting, nowSec + 5);
    if ("missed" in chosen) return { kind: "missed", why: chosen.missed };
    const payload = JSON.stringify({ source, feed, boundarySec: slot.boundarySec, priceE8: chosen.priceE8.toString(), unit: chosen.unit, fetchedAtSec: chosen.fetchedAtSec });
    return { kind: "ok", read: { priceE8: chosen.priceE8, fetchedAtSec: chosen.fetchedAtSec, payload, signers: 1, note: `PreStocks ${feed} read at T+${chosen.fetchedAtSec - slot.boundarySec}s` } };
  }

  async function readAlpaca(symbol: string, slot: ReadSlot, nowSec: number): Promise<ReadOutcome> {
    const keys = deps.alpaca;
    if (!keys) return { kind: "missed", why: "ALPACA_KEY_ID / ALPACA_SECRET_KEY are not set" };
    const t = slot.boundarySec;
    if (nowSec < t + 5) return wait("Alpaca is read from T + 5 s", t + 5);
    const iso = (sec: number) => new Date(sec * 1000).toISOString();
    const base = (keys.dataUrl ?? ALPACA_DATA_URL).replace(/\/+$/, "");
    const query = new URLSearchParams({ start: iso(t - ALPACA_MAX_STALE_SEC), end: iso(t), limit: "1", sort: "desc", feed: "iex" });
    const res = await fetchImpl(`${base}/stocks/${encodeURIComponent(symbol)}/trades?${query}`, {
      headers: { "APCA-API-KEY-ID": keys.keyId, "APCA-API-SECRET-KEY": keys.secretKey }, signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text();
    if (!res.ok) {
      const why = `Alpaca trades HTTP ${res.status}`;
      return res.status === 401 || res.status === 403 || nowSec > slot.deadlineSec - 5 ? { kind: "missed", why } : wait(why, nowSec + 5);
    }
    const trade = alpacaTradeAt(text, t);
    if ("error" in trade) return { kind: "missed", why: trade.error };
    return { kind: "ok", read: { priceE8: decimalToE8(trade.price), fetchedAtSec: nowSec, payload: text, signers: 1, note: `Alpaca ${symbol} IEX trade at T−${t - trade.atSec}s` } };
  }

  function readJupiter(xstock: string, slot: ReadSlot, nowSec: number): ReadOutcome {
    if (!(XSTOCK_SYMBOLS as readonly string[]).includes(xstock)) return { kind: "missed", why: `${xstock} is not an xStock` };
    const feed = deps.xstock?.() ?? null;
    if (!feed) return { kind: "missed", why: "no Jupiter xStock feed running" };
    const bar = jupiterBarAt(feed, xstock as XStockSymbol, slot.boundarySec);
    if ("missing" in bar) return { kind: "missed", why: bar.missing };
    const payload = JSON.stringify({ source: "jupiter", feed: xstock, boundarySec: slot.boundarySec, samples: bar.samples, medianE8: bar.medianE8.toString() });
    return { kind: "ok", read: { priceE8: bar.medianE8, fetchedAtSec: nowSec, payload, signers: 1, note: `Jupiter ${xstock} median of 3 samples` } };
  }

  return {
    async read(parts, slot, nowSec) {
      const feed = parts.feed ?? "";
      const source: AttestedSource = parts.source;
      if (nowSec < slot.earliestSec) return wait("before T + min delay", slot.earliestSec);
      if (nowSec > slot.deadlineSec) return { kind: "missed", why: "past the admission deadline" };
      switch (source) {
        case "redstone":
          return readRedstone(feed, slot, nowSec);
        case "pyth":
        case "pyth-index":
          return readPyth(source, feed.toLowerCase(), slot, nowSec);
        case "switchboard":
          return readSwitchboard(feed, slot, nowSec);
        case "prestocks":
        case "basket":
          return readPreStocks(source, feed, slot, nowSec);
        case "alpaca":
          return readAlpaca(feed, slot, nowSec);
        case "jupiter":
          return readJupiter(feed, slot, nowSec);
        default:
          return { kind: "missed", why: `${source} prints are not read by the lane feeder` };
      }
    },
  };
}
