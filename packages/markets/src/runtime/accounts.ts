/**
 * The venue's ledger facts, as the order lane and the read port consume them (first-call.md §2.1 shapes, kept).
 *
 * On Canton (C4) they come from our own public routes, which read the projection (`/api/venue/facts` for the venue
 * and every Series, `/api/venue/markets/<id>` for one Window), and from the venue's published ladder for a Book. A
 * seat's position and cash come from its own `/api/ledger/me/*` reads, for the seat this runtime has registered only;
 * any other owner reads as holding nothing here, never someone else's numbers. A read that cannot be answered throws
 * the route's diagnosis, so callers wrapped in `withReading` say what went wrong instead of inventing a value.
 */
import type { BookSideView } from "@agari/core/market";
import type { TickerSymbol } from "@agari/core/market";
import { diagnosis, type Address } from "@agari/core/types";
import { z } from "zod";
import { ReadingError } from "../errors/reading-error";
import { ledgerRequest, registeredSeatAddress } from "../provider/ledger-api";
import { balanceWire, meReplyWire, positionWire } from "../provider/ledger-wire";
import { marketFactsWire, venueFactsWire, venueRequest, type VenueFactsWire } from "../provider/venue-api";
import { ladderBase, ladderBookState, ladderLatestWire, parseLadder } from "./ladder";
import { peekClient } from "./read-runtime";

export interface VenueFacts {
  /** The venue's id as the app keys it. */
  config: Address;
  /** The venue cash instrument's id (the reference's collateral mint). */
  collateralMint: Address;
  decimals: number;
  treasury: Address;
  /** 0 Normal, 1 ReduceOnly, 2 Halted (the reference's `GlobalConfig.mode`; on Canton the venue's issuer policy). */
  mode: 0 | 1 | 2;
  /** Seats that trade and are not people (the reference's program seats: the pooled vault's, the maker's). */
  programSeats: Address[];
}

export interface SeriesFacts {
  address: Address;
  /** Null for a ticker outside the core registry. */
  symbol: TickerSymbol | null;
  basis: number;
  cadenceSec: number;
  lotBase: bigint;
  tickBase: bigint;
  cashUnit: bigint;
  minLots: bigint;
  /** Always 0 on Canton: a seat posts no bond (plan "Adapter mapping", `./runtime`). */
  seatBond: bigint;
  fillsCap: number;
  evictionsCap: number;
  minRestSlots: bigint;
  /** `Source` of each policy version's primary and check (0 none, 1 Pyth, 2 RedStone, 3 Switchboard, 4 attested). */
  policySources: readonly { primary: number; check: number }[];
}

/** One Window's terms and state, the fields the order lane and the read port use. */
export interface MarketData {
  series: Address;
  book: Address;
  ledger: Address;
  index: bigint;
  /** 0 open, 1 resolved, 2 voided (`MARKET_STATE`). */
  state: number;
  tradingStartSec: bigint;
  lockAtSec: bigint;
  expirySec: bigint;
  backingLots: bigint;
  payoutYes: number;
  payoutNo: number;
}

/**
 * One side-pair of the venue's published price ladder, walkable by core's book math. On Canton it is built from the
 * venue ladder (C4), not decoded from an account.
 */
export interface BookState {
  address: Address;
  /** The Window the ladder is bound to; a caller keyed on another Window reads it empty. */
  market: Address;
  series: Address;
  bids: BookSideView;
  asks: BookSideView;
  /** The rested-order filter's clock (kept for the shared kernel; a published ladder has no resting age). */
  slot: bigint;
  generation: number;
  orderCount: number;
}

/** A user's position in one Window (the reference's Ledger seat). */
export interface LedgerSeat {
  index: number;
  owner: Address;
  credit: bigint;
  lockedCash: bigint;
  yesFree: bigint;
  yesLocked: bigint;
  noFree: bigint;
  noLocked: bigint;
  openOrders: number;
  flags: number;
}

/** `Seat.flags` bits. */
export const SEAT_FLAG = { program: 1, bonded: 2 } as const;

// ---- the venue and its Series (`/api/venue/facts`) ------------------------------------------------------------------

/** A venue's mode can change (a halt); its identity and its Series' terms cannot. */
const VENUE_REFRESH_MS = 15_000;
/** A Series the facts did not list is asked for again at most this often (the roller may just have created it). */
const SERIES_MISS_MS = 5_000;

interface LoadedFacts {
  venue: VenueFacts;
  series: Map<string, SeriesFacts>;
  atMs: number;
}

let facts: LoadedFacts | null = null;
let factsInFlight: Promise<LoadedFacts> | null = null;
let lastSeriesMissMs = 0;

const failed = (d: Parameters<typeof diagnosis>[0], technical: string) => new ReadingError(diagnosis(d, technical));

function toFacts(w: VenueFactsWire): LoadedFacts {
  const venue: VenueFacts = {
    config: w.venue.config as Address,
    collateralMint: w.venue.collateralMint as Address,
    decimals: w.venue.decimals,
    treasury: w.venue.treasury as Address,
    mode: w.venue.mode,
    programSeats: w.venue.programSeats as Address[],
  };
  const series = new Map<string, SeriesFacts>();
  for (const s of w.series) {
    series.set(s.address, {
      address: s.address as Address,
      symbol: (s.symbol ?? null) as TickerSymbol | null,
      basis: s.basis,
      cadenceSec: s.cadenceSec,
      lotBase: s.lotBase,
      tickBase: s.tickBase,
      cashUnit: s.cashUnit,
      minLots: s.minLots,
      seatBond: s.seatBond,
      fillsCap: s.fillsCap,
      evictionsCap: s.evictionsCap,
      minRestSlots: s.minRestSlots,
      policySources: s.policySources,
    });
  }
  return { venue, series, atMs: Date.now() };
}

function loadFacts(force = false): Promise<LoadedFacts> {
  if (facts && !force && Date.now() - facts.atMs < VENUE_REFRESH_MS) return Promise.resolve(facts);
  factsInFlight ??= venueRequest("facts", venueFactsWire)
    .then((r): LoadedFacts => {
      if (!r.ok) throw new ReadingError(r.diagnosis);
      const loaded = toFacts(r.value);
      facts = loaded;
      return loaded;
    })
    .finally(() => {
      factsInFlight = null;
    });
  return factsInFlight;
}

/** The Series facts already loaded, without a read (the ladder coordinator's synchronous path). */
export function peekSeries(series: Address | string): SeriesFacts | null {
  return facts?.series.get(series) ?? null;
}

/** The venue facts already loaded, without a read. */
export function peekVenue(): VenueFacts | null {
  return facts?.venue ?? null;
}

/** The venue's id. Known once the venue facts have been read; before that there is nothing honest to return. */
export function eventsProgramAddress(): Address {
  if (facts) return facts.venue.config;
  throw failed("not-deployed", "the venue facts have not been read yet (/api/venue/facts)");
}

export const configAddress = async (): Promise<Address> => (await loadFacts()).venue.config;
export const readVenue = async (): Promise<VenueFacts> => (await loadFacts()).venue;
/** The venue's immutable facts without a mode refresh. */
export const readVenueStatic = async (): Promise<VenueFacts> => (facts ?? (await loadFacts())).venue;

export async function readSeries(series: Address): Promise<SeriesFacts> {
  const known = peekSeries(series) ?? (await loadFacts()).series.get(series);
  if (known) return known;
  if (Date.now() - lastSeriesMissMs > SERIES_MISS_MS) {
    lastSeriesMissMs = Date.now();
    const again = (await loadFacts(true)).series.get(series);
    if (again) return again;
  }
  throw failed("market-not-trading", `no Series ${series} on this venue`);
}

// ---- one Window (`/api/venue/markets/<id>`) ---------------------------------------------------------------------------

const MARKET_MEMO_MS = 1_000;
const marketMemo = new Map<string, { atMs: number; value: Promise<{ address: Address; data: MarketData } | null> }>();

/** Null when the Window doesn't exist. `ledger` and `book` are the app's ids for it: the Window id and its terms. */
export function readMarket(market: Address): Promise<{ address: Address; data: MarketData } | null> {
  const hit = marketMemo.get(market);
  if (hit && Date.now() - hit.atMs < MARKET_MEMO_MS) return hit.value;
  const value = venueRequest(`markets/${encodeURIComponent(market)}`, marketFactsWire).then((r) => {
    if (!r.ok) throw new ReadingError(r.diagnosis);
    const m = r.value.market;
    if (!m) return null;
    return { address: m.address as Address, data: { ...m.data, series: m.data.series as Address, book: m.data.book as Address, ledger: m.data.ledger as Address } };
  });
  value.catch(() => marketMemo.delete(market));
  marketMemo.set(market, { atMs: Date.now(), value });
  if (marketMemo.size > 256) for (const [key, entry] of marketMemo) if (Date.now() - entry.atMs > MARKET_MEMO_MS) marketMemo.delete(key);
  return value;
}

// ---- the registered seat's own position and cash (`/api/ledger/me/*`) --------------------------------------------

async function mine<W extends z.ZodType>(owner: Address, path: string, wire: W): Promise<z.output<W> | null> {
  if (registeredSeatAddress() !== owner) return null;
  const r = await ledgerRequest(`/me/${path}`, { method: "GET", wire: meReplyWire });
  if (!r.ok) throw new ReadingError(r.diagnosis);
  if (r.value.address !== owner) return null;
  const rows = wire.safeParse(r.value.value);
  if (!rows.success) throw failed("unknown", `/me/${path} answered an unexpected shape`);
  return rows.data as z.output<W>;
}

/**
 * Null = the Window's positions are closed; `seat` null = the owner holds nothing there. On Canton a seat posts no
 * bond and holds no venue credit (`seatBond` 0, `credit` 0); its legs are the seat's `Leg` contracts, summed per side.
 */
export async function readSeat(ledger: Address, owner: Address): Promise<{ seat: LedgerSeat | null; seatBond: bigint } | null> {
  const market = await readMarket(ledger);
  if (!market || market.data.state !== 0) return null;
  const positions = await mine(owner, "positions", z.array(positionWire));
  const row = positions?.find((p) => p.marketId === ledger);
  if (!row || (row.balanceUpRaw === 0n && row.balanceDownRaw === 0n)) return { seat: null, seatBond: 0n };
  const { lotBase } = await readSeries(market.data.series);
  const lots = (raw: bigint) => (lotBase > 0n ? raw / lotBase : 0n);
  return {
    seat: { index: 0, owner, credit: 0n, lockedCash: 0n, yesFree: lots(row.balanceUpRaw), yesLocked: 0n, noFree: lots(row.balanceDownRaw), noLocked: 0n, openOrders: 0, flags: 0 },
    seatBond: 0n,
  };
}

/** `amountBase` null = the owner holds no venue cash yet (or is not the seat this runtime reads for). */
export async function readTokenBalance(owner: Address, _mint: Address): Promise<{ ata: Address; amountBase: bigint | null }> {
  const sheet = await mine(owner, "balance", balanceWire);
  return { ata: owner, amountBase: sheet ? sheet.spendableBase : null };
}

// ---- a Window's Book: the venue ladder (`/ladders/latest`) --------------------------------------------------------

/** Null when the venue publishes no ladder for this Window (not quoting yet, or quoting is over). */
export async function readBook(book: Address): Promise<BookState | null> {
  const base = ladderBase(peekClient());
  if (!base) throw failed("not-deployed", "no ladder feed configured (NEXT_PUBLIC_LADDER_URL)");
  let json: unknown;
  try {
    const res = await fetch(`${base}/ladders/latest`, { cache: "no-store", headers: { accept: "application/json" } } as RequestInit);
    if (!res.ok) throw new Error(`ladders ${res.status}`);
    json = await res.json();
  } catch (error) {
    throw failed("rpc-down", `venue ladder unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = ladderLatestWire.safeParse(json);
  if (!parsed.success) throw failed("unknown", "the venue ladder answered an unexpected shape");
  for (const raw of parsed.data.ladders) {
    const ladder = parseLadder(raw);
    if (ladder && (ladder.termsCid === book || ladder.marketId === book)) return ladderBookState(ladder);
  }
  return null;
}
