/**
 * What a Canton Window settles on, as its `PolicyVersion.printSource` text (plan "Prices and lanes"): every reference
 * `PrintSource` (Pyth, RedStone, Switchboard, the attested PreStocks and basket reads) becomes an **attested print by
 * our oracle parties**, and the text names the original source and feed so every receipt can say where the number
 * came from. The crypto lanes keep the C3 text (three exchanges, one per oracle party).
 *
 *   attested:coinbase,kraken,bitstamp 1m candle close         the crypto lanes (C3), unchanged
 *   attested:redstone:TSLA                                    RedStone primary-prod data feed `TSLA` at T
 *   attested:pyth:16dad506…                                   Pyth Hermes price feed (lower-case hex) at T
 *   attested:switchboard:TSLAX/USD                            Switchboard Surge job for the xStock
 *   attested:prestocks:OPENAI                                 the PreStocks catalogue read (D-100/D-101)
 *   attested:basket:AILABS                                    a PreStocks basket's index (S19)
 *   attested:pyth-index:<hex>                                 a Pyth valuation index (S20, D-125 entitlement gate)
 *   attested:committee:<event id>                             a committee-attested event (C6, an Addition)
 *   attested:alpaca:QQQ                                       Alpaca's last IEX trade at or before T (C6e, K-070: QQQ/VOO after the Pyth trial)
 *   attested:jupiter:TSLAx                                    Jupiter Price v3, median of T − 40 / T − 20 / T (C6e, K-070: the reference's
 *                                                             token-lane fallback while Switchboard Surge cannot sign)
 *
 * Pure; ops (feeders, roller, source probe), the bootstrap and web all read it.
 */

export type AttestedSource = "exchanges" | "redstone" | "pyth" | "switchboard" | "prestocks" | "basket" | "pyth-index" | "committee" | "alpaca" | "jupiter";

export const ATTESTED_SOURCES: readonly AttestedSource[] = ["exchanges", "redstone", "pyth", "switchboard", "prestocks", "basket", "pyth-index", "committee", "alpaca", "jupiter"];

/** The C3 crypto text, byte for byte (the live Series carry it). */
export const EXCHANGE_PRINT_SOURCE = "attested:coinbase,kraken,bitstamp 1m candle close";

export interface PrintSourceParts {
  source: AttestedSource;
  /** The source's own feed name: `TSLA`, a Pyth feed id, `TSLAX/USD`, `OPENAI`, an event id; null for the exchanges. */
  feed: string | null;
}

/** The `printSource` text for a source and feed. */
export function attestedPrintSource(source: Exclude<AttestedSource, "exchanges">, feed: string): string {
  if (!feed || /\s/.test(feed)) throw new Error(`a ${source} print source needs a feed without spaces, got ${JSON.stringify(feed)}`);
  return `attested:${source}:${feed}`;
}

/** The inverse of `attestedPrintSource` (and the C3 exchange text); null for anything else. */
export function parsePrintSource(text: string): PrintSourceParts | null {
  if (text === EXCHANGE_PRINT_SOURCE || text.startsWith("attested:coinbase,kraken,bitstamp")) return { source: "exchanges", feed: null };
  const m = /^attested:([a-z-]+):(\S+)$/.exec(text);
  if (!m) return null;
  const source = m[1] as AttestedSource;
  if (!ATTESTED_SOURCES.includes(source) || source === "exchanges") return null;
  return { source, feed: m[2]! };
}

/** Who a receipt names as the original source. */
export const ATTESTED_SOURCE_LABEL: Record<AttestedSource, string> = {
  exchanges: "Coinbase, Kraken and Bitstamp 1-minute candle closes",
  redstone: "RedStone",
  pyth: "Pyth Hermes",
  switchboard: "Switchboard Surge",
  prestocks: "PreStocks",
  basket: "the PreStocks basket index",
  "pyth-index": "the Pyth valuation index",
  committee: "a committee attestation",
  alpaca: "Alpaca (last IEX trade)",
  jupiter: "Jupiter Price v3 (median of three samples)",
};

/**
 * One bar per source. An exchange print is the close of its 1-minute candle ending at T; every other source is a point
 * reading at (or just after) T, which the ledger stores as a 1-second bar `[T − 1, T)` (`PriceQuote` requires
 * `barLenSec > 0` and `barStart = T − barLenSec`).
 */
export const BAR_LEN_SEC: Record<AttestedSource, number> = {
  exchanges: 60, redstone: 1, pyth: 1, switchboard: 1, prestocks: 1, basket: 1, "pyth-index": 1, committee: 1, alpaca: 1, jupiter: 60,
};

/**
 * When a source's print for T is admissible, from the reference's `price-sources.json` defaults: RedStone and Pyth
 * land within 900 s of T (the relay fetches at T + 10 / T + 2); a Switchboard Surge read inside `[T + 10, T + 60]`;
 * a PreStocks name or basket inside `[T + 10, T + 45]` (`PRESTOCKS_MAX_LATE_SEC`), admitted for 900 s. A committee
 * attests after the event, so its print is admissible from T. An Alpaca print is the last IEX trade at or before T, read
 * from T + 5 and admitted like RedStone; a Jupiter print is the median of the samples at T − 40, T − 20 and T (the
 * reference's `jupiter-attest` bar `[T − 60, T]`), so it is ready at T + 5 and admitted for 60 s like Switchboard.
 */
export const SOURCE_TIMING: Record<AttestedSource, { minDelaySec: number; admissionSec: number }> = {
  exchanges: { minDelaySec: 5, admissionSec: 60 },
  redstone: { minDelaySec: 5, admissionSec: 900 },
  pyth: { minDelaySec: 2, admissionSec: 900 },
  switchboard: { minDelaySec: 10, admissionSec: 60 },
  prestocks: { minDelaySec: 10, admissionSec: 900 },
  basket: { minDelaySec: 10, admissionSec: 900 },
  "pyth-index": { minDelaySec: 60, admissionSec: 900 },
  committee: { minDelaySec: 0, admissionSec: 3_600 },
  alpaca: { minDelaySec: 5, admissionSec: 900 },
  jupiter: { minDelaySec: 5, admissionSec: 60 },
};

/** `paused: no signed source (<why>)` — the reference's honest state, with the reason ops found (C6). */
export const pausedNoSource = (why: string | null): string => (why ? `paused: no signed source (${why})` : "paused: no signed source");

/** The reason inside a `paused: no signed source (…)` state, or null. */
export function noSourceReason(state: string): string | null {
  const m = /^paused: no signed source \((.+)\)$/.exec(state);
  return m ? m[1]! : null;
}
