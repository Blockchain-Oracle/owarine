import { parsePrintSource, TICKERS, TICKER_SYMBOLS, type AttestedSource, type TickerSymbol } from "@agari/core/market";

/**
 * The landing's "Built on" figures (S25), pure over the index's `status/prints` rows (the `/status` print-source mix):
 * for each original source a closing print was read from, how many Windows closed on it and on which names. On Canton
 * every print is attested by the oracle parties, and the Window's policy `printSource` text (`attested:alpaca:QQQ`,
 * core `parsePrintSource`) names where the oracle parties read it, so the band lists the sources the rows hold and no
 * others: a lane that stops settling on a source drops out, and a source that starts (an entitled Pyth key, a
 * Switchboard version) appears with no edit here.
 */

/** 2026-09-11 00:00Z: the lower bound of the print-mix read; the Canton index holds no Window older than this. */
export const BUILT_ON_FROM_SEC = 1_789_084_800;

/** The index's print codes (`idx_prints.which` / `.source`, agari-events `Source`); the Canton view emits only 4, attested. */
const CLOSE_PRINT = 1;
const ATTESTED = 4;

/** The original sources the band can name, in the order it lists them. */
export const BUILT_ON_SOURCES = ["exchanges", "redstone", "alpaca", "jupiter", "prestocks", "pyth", "switchboard"] as const;
export type BuiltOnSource = (typeof BUILT_ON_SOURCES)[number];

/** Which band source an attested print's policy text belongs to; a committee's event attestation is not a price source. */
const BAND_SOURCE: Partial<Record<AttestedSource, BuiltOnSource>> = {
  exchanges: "exchanges",
  redstone: "redstone",
  alpaca: "alpaca",
  jupiter: "jupiter",
  prestocks: "prestocks",
  basket: "prestocks",
  pyth: "pyth",
  "pyth-index": "pyth",
  switchboard: "switchboard",
};

/** One `status/prints` row: a lane (`symbol`, `cadence_sec`), a print slot and its source, the Window's policy text, and how many Windows hold it. */
export interface MixRow {
  symbol: string | null;
  which: number | null;
  source: number | null;
  /** The Windows' policy `printSource` text; absent on an index that does not project it. */
  print_source?: string | null;
  windows: number;
}

export interface SourceTally {
  source: BuiltOnSource;
  /** Windows whose closing print was read from this source. */
  windows: number;
  /** Listed names, registry order. */
  names: TickerSymbol[];
  /** Baskets among them (PreStocks only). */
  baskets: TickerSymbol[];
}

const isTicker = (symbol: string | null): symbol is TickerSymbol => symbol !== null && (TICKER_SYMBOLS as readonly string[]).includes(symbol);
const isPreStocks = (symbol: TickerSymbol): boolean => TICKERS[symbol].kind === "preIpo" || TICKERS[symbol].kind === "basket";

/**
 * The original source a recorded print was read from, or null when the rows do not say. An attested print is named by
 * its Window's policy text; without the text a pre-IPO name or a basket is still PreStocks by construction (D-100,
 * D-124), and anything else is left unnamed rather than guessed.
 */
export function printedSource(symbol: string | null, source: number | null, printSource: string | null | undefined): BuiltOnSource | null {
  if (source !== ATTESTED) return null;
  const parts = printSource ? parsePrintSource(printSource) : null;
  if (parts) return BAND_SOURCE[parts.source] ?? null;
  return isTicker(symbol) && isPreStocks(symbol) ? "prestocks" : null;
}

/** One entry per source that closed at least one Window, in the band's order; a source with none is not listed. */
export function builtOnTally(rows: readonly MixRow[]): SourceTally[] {
  const by = new Map<BuiltOnSource, { windows: number; seen: Set<TickerSymbol> }>();
  for (const row of rows) {
    if (row.which !== CLOSE_PRINT || !isTicker(row.symbol)) continue;
    const source = printedSource(row.symbol, row.source, row.print_source);
    if (source === null) continue;
    const have = by.get(source) ?? { windows: 0, seen: new Set<TickerSymbol>() };
    have.windows += row.windows;
    have.seen.add(row.symbol);
    by.set(source, have);
  }
  return BUILT_ON_SOURCES.flatMap((source) => {
    const have = by.get(source);
    if (!have || have.windows <= 0) return [];
    const ordered = TICKER_SYMBOLS.filter((s) => have.seen.has(s));
    return [{ source, windows: have.windows, names: ordered.filter((s) => TICKERS[s].kind !== "basket"), baskets: ordered.filter((s) => TICKERS[s].kind === "basket") }];
  });
}

/** "OpenAI", "OpenAI and Anthropic", "TSLA, QQQ and VOO": a listed name by its ticker, a pre-IPO name by its company; a long list ends "and 3 more". */
export function namesLine(names: readonly TickerSymbol[], max = 6): string {
  const words = names.map((s) => (TICKERS[s].kind === "preIpo" ? TICKERS[s].name : s));
  if (words.length > max) return `${words.slice(0, max).join(", ")} and ${words.length - max} more`;
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
