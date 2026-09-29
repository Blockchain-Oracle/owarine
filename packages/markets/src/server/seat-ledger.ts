/**
 * Everything the seat routes do on the ledger, behind one object built once per server process: per-party reads mapped
 * onto the core types, the seat's own commands, and the ops client for the venue's side of a quote.
 */
import type { LedgerClient, Party } from "@agari/ledger";
import type { BalanceSheet, ClaimableRow, OpenPosition } from "@agari/core/types";
import type { TermsView } from "./contracts";
import { balanceSheet, busyUntilMs, claimables, claimPlans, openPositions, openQuotes, type OpenQuoteRow } from "./map";
import { createMarketReader, createSeatReader, type MarketReader, type SeatReader, type SeatSnapshot } from "./reads";
import { createSeatWriter, type CommandJournal, type SeatWriter } from "./writes";

export interface SeatLedgerConfig {
  client: LedgerClient;
  /** The venue party, used ONLY to read market metadata (terms, resolutions); nothing is ever submitted as it. */
  venueParty: Party;
  journal: CommandJournal;
  now?: () => number;
}

export interface SeatRead<T> {
  value: T;
  party: Party;
  offset: number;
  /** The seat's busy clock after this read: its last open leg's refund deadline or live quote's expiry (0 = idle). */
  busyUntilMs: number;
  /** The earliest refund deadline among its open legs (0 when none): the long-hold drain rule reads it. */
  nextSettleMs: number;
  openLegs: number;
}

export interface SeatLedger {
  readonly seats: SeatReader;
  readonly markets: MarketReader;
  readonly writer: SeatWriter;
  readonly client: LedgerClient;
  balance(party: Party): Promise<SeatRead<BalanceSheet>>;
  positions(party: Party): Promise<SeatRead<OpenPosition[]>>;
  claimables(party: Party): Promise<SeatRead<ClaimableRow[]>>;
  quotes(party: Party): Promise<SeatRead<OpenQuoteRow[]>>;
  /** The terms of every Window the snapshot's legs are on. */
  termsFor(snap: SeatSnapshot): Promise<Map<string, TermsView>>;
}

export function createSeatLedger(cfg: SeatLedgerConfig): SeatLedger {
  const now = cfg.now ?? Date.now;
  const seats = createSeatReader(cfg.client, { now });
  const markets = createMarketReader(cfg.client, cfg.venueParty, { now });
  const writer = createSeatWriter({ client: cfg.client, seats, markets, journal: cfg.journal, now });

  const wrap = <T>(snap: SeatSnapshot, value: T): SeatRead<T> => ({
    value,
    party: snap.party,
    offset: snap.offset,
    busyUntilMs: busyUntilMs(snap),
    nextSettleMs: snap.legs.length ? Math.min(...snap.legs.map((l) => l.refundAfterMs)) : 0,
    openLegs: snap.legs.length,
  });

  async function termsFor(snap: SeatSnapshot): Promise<Map<string, TermsView>> {
    const ids = [...new Set(snap.legs.map((l) => l.termsCid))];
    const found = await Promise.all(ids.map((id) => markets.terms(id)));
    const out = new Map<string, TermsView>();
    found.forEach((t) => t && out.set(t.cid, t));
    return out;
  }

  return {
    seats,
    markets,
    writer,
    client: cfg.client,
    termsFor,
    async balance(party) {
      const snap = await seats.read(party);
      return wrap(snap, balanceSheet(snap));
    },
    async positions(party) {
      const snap = await seats.read(party);
      return wrap(snap, openPositions(snap.legs, await termsFor(snap)));
    },
    async claimables(party) {
      const snap = await seats.read(party);
      if (snap.legs.length === 0) return wrap(snap, []);
      const [terms, resolutions] = await Promise.all([termsFor(snap), markets.resolutions()]);
      return wrap(snap, claimables(claimPlans(snap.legs, resolutions, now()), terms));
    },
    async quotes(party) {
      const snap = await seats.read(party);
      return wrap(snap, openQuotes(snap.quotes.filter((q) => q.validUntilMs > now())));
    },
  };
}
