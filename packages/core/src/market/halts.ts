import { TRADING_HALT_REASONS, type HaltBoard, type HaltEntry, type HaltReason } from "../types/session-lanes";
import type { AttestedSource } from "./print-source";
import { TICKER_SYMBOLS, TICKERS, XSTOCK_SYMBOLS, type TickerSymbol, type XStockSymbol } from "./tickers";

/**
 * Halt rules (session-lanes.md §3.1, D-057). No licensed halt feed exists (C:02 §B), so a lane is halted when the
 * signed price it settles on stops being printable, and only the source it settles on counts (C6f): the newest dated
 * version of the lane's policy names it (`primarySourceAt`), so a Pyth tick never halts a lane that settles on RedStone
 * or Alpaca. Each source has its own health signal:
 *
 *   pyth        a tick wider than the policy's 50 bps can't print (prints.md §4.1 step 5), or older than 15 s
 *   redstone    the newest package of the feed older than 60 s
 *   alpaca      the newest IEX trade older than 120 s (QQQ and VOO; C6f)
 *   prestocks   the newest catalogue read older than 60 s (a pre-IPO name, or the basket over the same read; C6f)
 *   issuer      xStocks' own `isMarketTradingHalted` flag, and Jupiter quotes failing three in a row (the token lane)
 *
 * Crypto is not covered: it trades 24/7 on three exchanges, and neither the reference (which had no crypto lane) nor
 * Canton has a halt for it. Pure: `halt-watch` reads the sources, this decides.
 *
 * A halt never touches the chain. It stops the roller listing and the maker quoting; a Window already open voids by
 * itself when its print can't be recorded, and its verdict names the missing print, never the halt (§3.2).
 */

export type HaltAsset = TickerSymbol | XStockSymbol;

/**
 * How a halt asset is watched. `session`: a listed stock or ETF (its Regular and Gap lanes), watched in regular hours only;
 * `always`: a 24/7 lane (an xStock, a pre-IPO name, a basket), watched every hour. Null: not covered (crypto, a valuation
 * lane, whose Pyth index is the roller's entitlement gate).
 */
export type HaltWatch = "session" | "always" | null;

export function haltWatchOf(asset: HaltAsset): HaltWatch {
  if ((XSTOCK_SYMBOLS as readonly string[]).includes(asset)) return "always";
  const kind = TICKERS[asset as TickerSymbol]?.kind;
  if (kind === "stock" || kind === "etf") return "session";
  return kind === "preIpo" || kind === "basket" ? "always" : null;
}

/** Every asset a halt can be keyed by: the ticker (Regular and Gap lanes, pre-IPO and basket lanes), the xStock (token lane). */
export const HALT_ASSETS: readonly HaltAsset[] = [...TICKER_SYMBOLS, ...XSTOCK_SYMBOLS].filter((asset) => haltWatchOf(asset) !== null);

/** The Pyth policy's `max_conf_bps` (D-003): a wider tick could not print. */
export const PYTH_HALT_CONF_BPS = 50;
/** A Pyth equity feed ticks every ≈ 400 ms in regular hours; 15 s without one is a stopped feed. */
export const PYTH_STALE_SEC = 15;
/** RedStone packages land every ≈ 10 s; the newest older than 60 s is a stopped feed. */
export const REDSTONE_STALE_SEC = 60;
/**
 * A QQQ or VOO print is the last IEX trade in `[T − 300 s, T]` (`ALPACA_MAX_STALE_SEC`, attested-read.ts), and the roller
 * lists a Window up to its 120 s lead ahead of `T`. A last trade over 120 s old at listing can therefore be over 240 s old
 * at `T`, still inside the 300 s bound; a newest trade past 120 s (also where the spot feed stops calling an IEX trade the
 * last price, `ALPACA_MAX_AGE_SEC`) says the trades have stopped, and a Window listed on it could void. Deliberately not
 * tighter: VOO's IEX volume is thin, and a quiet minute is not a halt.
 */
export const ALPACA_STALE_SEC = 120;
/**
 * The PreStocks catalogue is read every 10 s and a print takes the first read in `[T + 10, T + 45]`, so a newest read older
 * than 60 s (six missed polls, as RedStone's 60 s over its ≈ 10 s packages) is a read that has stopped. A rate-limited host
 * backs off 30 s and doubling, so two failed reads in a row trip it.
 */
export const PRESTOCKS_STALE_SEC = 60;
/** Consecutive failed quotes before the token lane halts (Canton: Jupiter Price v3 polls, every 5 s). */
export const QUOTE_FAILURES_TO_HALT = 3;

/** One Pyth tick in the source's own exponent (both scaled alike, so the ratio needs no normalization). */
export interface PythTick {
  price: bigint;
  conf: bigint;
  publishTimeSec: number;
}

/**
 * `pyth-stale` when no tick is newer than 15 s (a stale tick's width says nothing about now, so staleness wins),
 * else `pyth-wide` when `conf × 10⁴ > price × 50` or the price isn't positive.
 */
export function pythHaltReason(tick: PythTick | null, nowSec: number, maxConfBps = PYTH_HALT_CONF_BPS): HaltReason | null {
  if (!tick || nowSec - tick.publishTimeSec > PYTH_STALE_SEC) return "pyth-stale";
  if (tick.price <= 0n || tick.conf * 10_000n > tick.price * BigInt(maxConfBps)) return "pyth-wide";
  return null;
}

/** `redstone-stale` when the newest package of the feed is older than 60 s, or none was seen. */
export function redstoneHaltReason(newestPackageSec: number | null, nowSec: number): HaltReason | null {
  return newestPackageSec === null || nowSec - newestPackageSec > REDSTONE_STALE_SEC ? "redstone-stale" : null;
}

/** `alpaca-stale` when the newest IEX trade of the ticker is older than 120 s, or none was seen. */
export function alpacaHaltReason(newestTradeSec: number | null, nowSec: number): HaltReason | null {
  return newestTradeSec === null || nowSec - newestTradeSec > ALPACA_STALE_SEC ? "alpaca-stale" : null;
}

/** `prestocks-stale` when the newest catalogue read that priced the name (or every member of the basket) is older than 60 s, or none was seen. */
export function prestocksHaltReason(newestReadSec: number | null, nowSec: number): HaltReason | null {
  return newestReadSec === null || nowSec - newestReadSec > PRESTOCKS_STALE_SEC ? "prestocks-stale" : null;
}

/** The token lane: the issuer's own halt flag first (`null` = not read yet), then three failed quotes in a row. */
export function tokenHaltReason(issuerHalted: boolean | null, consecutiveQuoteFailures: number): HaltReason | null {
  if (issuerHalted === true) return "issuer-halt";
  return consecutiveQuoteFailures >= QUOTE_FAILURES_TO_HALT ? "quote-unavailable" : null;
}

/** A lane's policy versions reduced to what halts need (ops `lane-versions.ts`: the table the bootstrap registers the Series from). */
export interface SourceVersion {
  validFromSec: number;
  /** Null = open-ended. Inclusive, like the roller's coverage rule (prints.md §2.3). */
  validUntilSec: number | null;
  /** The attested source the version's `printSource` names (`parsePrintSource`). */
  primary: AttestedSource;
}

/** The primary source of the newest version valid at `nowSec`; null when no version is (the lane is paused, not halted). */
export function primarySourceAt(versions: readonly SourceVersion[], nowSec: number): AttestedSource | null {
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!;
    if (v.validFromSec <= nowSec && (v.validUntilSec === null || nowSec <= v.validUntilSec)) return v.primary;
  }
  return null;
}

/** What halt-watch last saw of each source a lane can settle on (the asset's own reads; null = none yet). */
export interface SourceReads {
  pyth: PythTick | null;
  redstoneNewestSec: number | null;
  alpacaNewestSec: number | null;
  prestocksNewestSec: number | null;
}

/**
 * A lane's halt from the source it settles on now (`primary`, from `primarySourceAt`): only that source's health counts,
 * so a stale RedStone package never halts a lane that settles on Alpaca. A source with no rule here (the exchanges, a
 * committee, a valuation index, and the token lane's Jupiter and Switchboard, which `tokenHaltReason` judges) and a lane
 * with no source (paused, never halted) give null.
 */
export function sourceHaltReason(primary: AttestedSource | null, reads: SourceReads, nowSec: number): HaltReason | null {
  switch (primary) {
    case "pyth":
      return pythHaltReason(reads.pyth, nowSec);
    case "redstone":
      return redstoneHaltReason(reads.redstoneNewestSec, nowSec);
    case "alpaca":
      return alpacaHaltReason(reads.alpacaNewestSec, nowSec);
    case "prestocks":
    case "basket":
      return prestocksHaltReason(reads.prestocksNewestSec, nowSec);
    default:
      return null;
  }
}

/** Observations in a row before a lane's halt state changes. The issuer flag is authoritative and applies at once. */
export function confirmPasses(observed: HaltReason | null): number {
  return observed === "issuer-halt" ? 1 : 2;
}

export interface HaltStreak {
  /** The observed state that differs from the confirmed one. */
  pending: HaltReason | null;
  seen: number;
}

/**
 * One observation against the confirmed state: a different reason (or a clear) takes effect only after
 * `confirmPasses` observations in a row, so one late tick or one failed read never flips a lane.
 */
export function confirmHalt(confirmed: HaltReason | null, streak: HaltStreak | null, observed: HaltReason | null): { confirmed: HaltReason | null; streak: HaltStreak | null } {
  if (observed === confirmed) return { confirmed, streak: null };
  const seen = streak && streak.pending === observed ? streak.seen + 1 : 1;
  return seen >= confirmPasses(observed) ? { confirmed: observed, streak: null } : { confirmed, streak: { pending: observed, seen } };
}

/** Q-S6-9: only a wide Pyth confidence or the issuer's flag says "Trading halted"; a stale or unquoted source says why. */
export function haltLabel(reason: HaltReason): "Trading halted" | "Signed price stale" {
  return TRADING_HALT_REASONS.includes(reason) ? "Trading halted" : "Signed price stale";
}

/** The roller's lane state for a halted asset. */
export function haltPausedState(entry: HaltEntry): string {
  return `paused: halted (${entry.reason})`;
}

export function haltOf(board: HaltBoard, asset: HaltAsset): HaltEntry | null {
  return board[asset] ?? null;
}
