/**
 * The arena desk's view of the ledger (C9b): the venue's `ArenaTerms` (with its disclosure, which a seat's open
 * carries), every live `DuelOpen` and `DuelMatch`, the season pools and the Windows' resolutions, read as the venue.
 * Every figure the reads serve is the ledger's; the desk adds only what the ledger cannot know: which seat address a
 * party is, and which sealed deck the matchmaker is holding for which pairing until its creator opens it.
 */
import { GAMES_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { Address } from "@agari/core/types";
import { readSeasonClosure, recordSeasonClosure, type SeasonClosure } from "@agari/db";
import { decodeResolution, decodeTerms, pick, readActive, type Active, type ResolutionC, type RoleSession, type TermsC } from "@agari/markets/ops/canton";
import {
  arenaAddressOf, arenaParamsOf, decodeArenaTerms, decodeDuelMatch, decodeDuelOpen, decodeDuelResult, decodeSeasonPool, isStakeTierId, tierIndexOf,
  viewOfMatch, viewOfOpen, viewOfResult, type ArenaTermsC, type DuelMatchC, type DuelOpenC, type DuelResultC, type SeasonPoolC,
} from "@agari/markets/ops/games";
import type { ArenaMatchViewWire, SeasonPoolWire } from "@agari/markets/games";
import type { ArenaStateReply } from "@agari/markets/server";
import type { SeatDirectory } from "./seats";

const G = GAMES_TEMPLATE_IDS;
const SNAP_MS = 1_500;

export interface ArenaTermsActive extends Active<ArenaTermsC> {
  templateId: string;
  createdEventBlob: string;
  synchronizerId: string;
}

export interface ArenaSnapshot {
  atMs: number;
  terms: ArenaTermsActive | null;
  opens: Active<DuelOpenC>[];
  matches: Active<DuelMatchC>[];
  pools: Active<SeasonPoolC>[];
  /** Resolution per terms contract id. */
  resolutions: Map<string, Active<ResolutionC>>;
}

/** A sealed deck the matchmaker holds for one pairing until its creator's `Arena_OpenDuel` lands. */
export interface PendingDeal {
  matchId: string;
  creator: Address;
  challenger: Address;
  tierId: string;
  arenaId: string;
  deckHash: string;
  deckSize: number;
  clientSeeds: readonly string[];
}

/** Where closed seasons are kept (Postgres by default); a test passes its own. */
export interface SeasonClosureStore {
  record: (c: SeasonClosure) => Promise<boolean>;
  read: (seasonId?: string) => Promise<SeasonClosure | null>;
}

const DB_CLOSURES: SeasonClosureStore = { record: recordSeasonClosure, read: readSeasonClosure };

export function createArenaDesk(input: { venue: RoleSession; seats: SeatDirectory; chainId: number; log: (why: string) => void; closures?: SeasonClosureStore }) {
  const { venue, seats } = input;
  const closureStore = input.closures ?? DB_CLOSURES;
  /** Closures this process made, so a withdrawn season reads as paid out even with no database. */
  const closedHere = new Map<string, SeasonClosure>();
  let snap: { atMs: number; value: Promise<ArenaSnapshot> } | null = null;
  const pending = new Map<string, PendingDeal>();
  const results = new Map<string, Active<DuelResultC>>();
  const onBad = (cid: string, error: unknown) => input.log(`undecodable ${cid.slice(0, 12)}…: ${error instanceof Error ? error.message : String(error)}`);

  async function read(): Promise<ArenaSnapshot> {
    const [withBlob, acs] = await Promise.all([
      venue.client.activeContracts({ parties: [venue.party], templateIds: [G.ArenaTerms], includeCreatedEventBlob: true }),
      readActive(venue, [G.DuelOpen, G.DuelMatch, G.SeasonPool, TEMPLATE_IDS.Resolution]),
    ]);
    const mine = <X extends { venue: string }>(xs: Active<X>[]) => xs.filter((x) => x.data.venue === venue.party);
    let terms: ArenaTermsActive | null = null;
    for (const c of withBlob.contracts) {
      const e = c.createdEvent;
      try {
        const data = decodeArenaTerms(e.createArgument);
        if (data.venue !== venue.party || !e.createdEventBlob) continue;
        terms = { cid: e.contractId, data, templateId: e.templateId, createdEventBlob: e.createdEventBlob, synchronizerId: c.synchronizerId };
      } catch (error) {
        onBad(e.contractId, error);
      }
    }
    const resolutions = new Map<string, Active<ResolutionC>>();
    for (const r of mine(pick(acs, TEMPLATE_IDS.Resolution, decodeResolution, onBad))) resolutions.set(r.data.termsCid, r);
    const opens = mine(pick(acs, G.DuelOpen, decodeDuelOpen, onBad));
    const matches = mine(pick(acs, G.DuelMatch, decodeDuelMatch, onBad));
    await seats.learn([...opens, ...matches].flatMap((m) => [m.data.creator, m.data.challenger]));
    for (const o of opens) pending.delete(o.data.matchId);
    for (const m of matches) pending.delete(m.data.matchId);
    return { atMs: Date.now(), terms, opens, matches, pools: mine(pick(acs, G.SeasonPool, decodeSeasonPool, onBad)), resolutions };
  }

  function snapshot(o: { fresh?: boolean } = {}): Promise<ArenaSnapshot> {
    if (!o.fresh && snap && Date.now() - snap.atMs < SNAP_MS) return snap.value;
    const value = read();
    const entry = { atMs: Date.now(), value };
    snap = entry;
    value.catch(() => snap === entry && (snap = null));
    return value;
  }

  /** A decided match's result; results never change, so a found one is kept. */
  async function resultOf(matchId: string): Promise<Active<DuelResultC> | null> {
    const hit = results.get(matchId);
    if (hit) return hit;
    const acs = await readActive(venue, [G.DuelResult]);
    for (const r of pick(acs, G.DuelResult, decodeDuelResult, onBad)) if (r.data.venue === venue.party) results.set(r.data.matchId, r);
    await seats.learn([...results.values()].flatMap((r) => [r.data.creator, r.data.challenger]));
    return results.get(matchId) ?? null;
  }

  async function state(): Promise<ArenaStateReply> {
    const s = await snapshot();
    const t = s.terms;
    const escrowedBase = s.opens.reduce((a, o) => a + o.data.tier.potEach, 0n) + s.matches.reduce((a, m) => a + 2n * m.data.tier.potEach, 0n);
    if (!t) {
      return {
        deployed: false, chainId: input.chainId, arenaId: "", address: arenaAddressOf("none"), policyVersion: 0,
        params: { joinWindowSec: 0, revealWindowSec: 0, pickWindowSec: 0, minDeckSize: 0, maxDeckSize: 0, minCardLifeSec: 0 }, tiers: [], paused: true, escrowedBase, asOfMs: s.atMs,
      };
    }
    const tiers = t.data.tiers.filter((x) => isStakeTierId(x.tierId)).map((x) => ({ tier: tierIndexOf(x.tierId), tierId: x.tierId, potBase: x.potEach, perCardCapBase: x.perCardCap, enabled: x.enabled, ranked: x.ranked }));
    return {
      deployed: true, chainId: input.chainId, arenaId: t.data.arenaId, address: arenaAddressOf(t.data.arenaId), policyVersion: t.data.policyVersion,
      params: arenaParamsOf(t.data.params), tiers, paused: !tiers.some((x) => x.enabled), escrowedBase, asOfMs: s.atMs,
    };
  }

  /** One match by its room id: the live contract that holds it, else its result. */
  async function match(matchId: string): Promise<ArenaMatchViewWire | null> {
    const id = matchId.toLowerCase();
    const s = await snapshot();
    const addressOf = seats.addressOf;
    const m = s.matches.find((x) => x.data.matchId === id);
    if (m) return { ...viewOfMatch(m.data, addressOf), serverSeed: m.data.serverSeed, clientSeeds: m.data.clientSeeds, arenaId: m.data.arenaId };
    const o = s.opens.find((x) => x.data.matchId === id);
    if (o) return { ...viewOfOpen(o.data, addressOf), serverSeed: null, clientSeeds: o.data.clientSeeds, arenaId: o.data.arenaId };
    const r = await resultOf(id);
    if (!r) return null;
    const tier = s.terms?.data.tiers.find((x) => x.tierId === r.data.tierId);
    const view = viewOfResult(r.data, seats.addressOf, tier ? { deckHash: "0".repeat(64), deckSize: r.data.cards.length, policyVersion: s.terms?.data.policyVersion ?? 0, potEach: tier.potEach, perCardCap: tier.perCardCap } : undefined);
    return { ...view, serverSeed: r.data.serverSeed, clientSeeds: [], arenaId: r.data.arenaId };
  }

  /**
   * The newest pool, or the one named. Its admin is the venue, shown as the arena's own id. A pool the venue closed
   * (`Season_WithdrawRemainder` archives it) reads as the reference's drained pool: paid out, holding nothing.
   */
  async function season(seasonId?: string): Promise<SeasonPoolWire | null> {
    const s = await snapshot();
    const pools = s.pools.filter((p) => !seasonId || p.data.seasonId === seasonId).sort((a, b) => b.data.endsAtSec - a.data.endsAtSec);
    const p = pools[0];
    if (p) {
      return {
        address: arenaAddressOf(`season:${p.data.seasonId}`), seasonId: p.data.seasonId, endsAtSec: p.data.endsAtSec, admin: arenaAddressOf("venue"),
        balanceBase: p.data.amount, depositedBase: p.data.deposited, distributed: p.data.distributed,
      };
    }
    const closed = (seasonId ? closedHere.get(seasonId) : undefined) ?? (await closureStore.read(seasonId).catch(() => null));
    if (!closed) return null;
    return {
      address: arenaAddressOf(`season:${closed.seasonId}`), seasonId: closed.seasonId, endsAtSec: closed.endsAtSec, admin: arenaAddressOf("venue"),
      balanceBase: 0n, depositedBase: closed.depositedBase, distributed: true,
    };
  }

  /** Remembers a closure the ledger accepted; the database write is best effort (the ledger holds the fact). */
  async function recordClosure(c: SeasonClosure): Promise<void> {
    closedHere.set(c.seasonId, c);
    snap = null;
    await closureStore.record(c).catch((error: unknown) => input.log(`season ${c.seasonId}: closure not recorded in the database: ${error instanceof Error ? error.message : String(error)}`));
  }

  /** The venue's MarketTerms by Daml market id, for a reveal's card contract ids. */
  async function termsByMarketId(ids: readonly string[]): Promise<Map<string, Active<TermsC>>> {
    const want = new Set(ids);
    const acs = await readActive(venue, [TEMPLATE_IDS.MarketTerms]);
    const out = new Map<string, Active<TermsC>>();
    for (const t of pick(acs, TEMPLATE_IDS.MarketTerms, decodeTerms, onBad)) if (want.has(t.data.marketId) && t.data.venue === venue.party) out.set(t.data.marketId, t);
    return out;
  }

  return {
    venue, seats, snapshot, state, match, season, recordClosure, resultOf, termsByMarketId,
    /** The matchmaker's sealed deck for a pairing, until the creator's open lands (the snapshot then drops it). */
    hold: (deal: PendingDeal) => void pending.set(deal.matchId.toLowerCase(), deal),
    release: (matchId: string) => void pending.delete(matchId.toLowerCase()),
    pendingDeal: (matchId: string) => pending.get(matchId.toLowerCase()) ?? null,
    invalidate: () => void (snap = null),
  };
}

export type ArenaDesk = ReturnType<typeof createArenaDesk>;
