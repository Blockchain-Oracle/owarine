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
 *
 * Nothing is clamped or guessed: a read that cannot be made inside its window is `missed`, and the Window voids on a
 * missing print. The payload is the exact response text where the source has one (RedStone's feed array, Hermes and
 * the crossbar bodies); a PreStocks read keeps no body, so its payload is the sample the process holds, as JSON.
 */
import { BASKETS, isTickerSymbol, type AttestedSource, type BasketSymbol, type PrintSourceParts } from "@agari/core/market";
import { decimalToE8 } from "@agari/markets/ops/prints";
import { fetchPythAt } from "../actors/price-relay/hermes-fetch";
import { choosePrint } from "../actors/price-relay/prestocks-pass";
import { feedAt, fetchRedstoneAt } from "../actors/price-relay/redstone-fetch";
import type { RelaySources } from "../actors/price-relay/sources";
import type { PythEntitlementStore } from "../runtime/pyth-entitlement";
import type { PreStocksSpotFeed } from "./prestocks-spot";

export const SWITCHBOARD_CROSSBAR = "https://crossbar.switchboard.xyz";
/** The relay fetched RedStone at T + 10 (`REDSTONE_FETCH_AFTER_SEC`); a thin boundary is retried until T + this. */
export const REDSTONE_THIN_UNTIL_SEC = 120;
const SWITCHBOARD_WINDOW_SEC = 60;
const PYTH_GRACE_SEC = { pyth: 5, "pyth-index": 60 } as const;

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
        default:
          return { kind: "missed", why: `${source} prints are not read by the lane feeder` };
      }
    },
  };
}
