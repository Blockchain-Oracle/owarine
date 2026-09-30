import "server-only";
import { getDb } from "@agari/db";
import { ledgerClientFromEnv, parseLedgerEnv, type LedgerClient } from "@agari/ledger";
import { err, ok } from "@agari/core/schemas";
import { CC_RAIL_CAPABILITY } from "@agari/core/cc";
import { registerArenaSource } from "@agari/markets/games";
import {
  createAgentsSeat, createCcSeat, createDeskSeat, createGamesSeat, createOpsClient, createSeatLedger, createTicketSeat,
  type AgentsSeat, type CcSeat, type DeskSeat, type GamesSeat, type OpsClient, type SeatLedger, type TicketSeat,
} from "@agari/markets/server";
import { checkWebServerEnv, seatParties, type SeatParties, type WebServerEnv } from "./server-env";
import { createSeatStore, type SeatStore } from "./seat-store.server";

/**
 * The web tier's ledger access (plan §1, §3), built once per process and only here: `import "server-only"` makes any
 * client import of this module fail the build. It holds the ledger credential (a password grant per process on
 * Noders, plan §9 option A), the seat parties, and the seat store. Route handlers never see the venue party: they get
 * the seat party the lease row names, and market metadata is read through `SeatLedger`.
 */
export interface SeatServer {
  client: LedgerClient;
  ledger: SeatLedger;
  /** The seat's side of the ticket products (C8c): its own tickets, accepts, claims and refunds. */
  tickets: TicketSeat;
  /** The seat's grants and strategy registry side (C8f). */
  agents: AgentsSeat;
  /** The seat's Canton Coin path (C7b): its allowance, receipts and withdrawal asks; every write refuses while the path is not-live. */
  cc: CcSeat;
  /** The owner's side of the live desk (C8f). */
  desk: DeskSeat;
  /** The seat's side of the duel (C9b): open, join, pick, cancel and the player's cranks. */
  games: GamesSeat;
  ops: OpsClient;
  store: SeatStore;
  parties: SeatParties;
  env: WebServerEnv & { AGARI_SEAT_COOKIE_SECRET: string };
}

export type SeatServerState = { ok: true; server: SeatServer } | { ok: false; reason: string };

let state: SeatServerState | null = null;

/** The configured seat tier, or why it is not live (development without the seat variables). */
export function seatServer(): SeatServerState {
  if (state) return state;
  const { problems, env } = checkWebServerEnv(process.env);
  const db = getDb();
  if (problems.length > 0 || !env || !db) {
    state = { ok: false, reason: `seat tier not configured: ${problems.map((p) => p.split(":")[0]).join(", ") || "DATABASE_URL"}` };
    return state;
  }
  const client = ledgerClientFromEnv(parseLedgerEnv(process.env));
  const parties = seatParties(env);
  const store = createSeatStore(db, parties.seats);
  const ops = createOpsClient({ baseUrl: env.OPS_INTERNAL_URL!, secret: env.OPS_INTERNAL_SECRET! });
  const ledger = createSeatLedger({ client, venueParty: parties.venue!, journal: store.commands, marks: () => ops.ladderMarks() });
  const tickets = createTicketSeat({ client, venueParty: parties.venue!, journal: store.commands, fairTicks: () => ops.fairTicks(), ladders: () => ops.quotingLadders() });
  const agents = createAgentsSeat({ client, venueParty: parties.venue!, agentRunner: parties.agentRunner, journal: store.commands, ops });
  const cc = createCcSeat({ client, venueParty: parties.venue!, journal: store.commands, listingId: process.env.CC_LISTING_ID || "cc-1", capability: CC_RAIL_CAPABILITY });
  const desk = createDeskSeat({ client, venueParty: parties.venue!, operator: parties.agentRunner, attestors: parties.oracles, journal: store.commands, ops });
  const games = createGamesSeat({ client, venueParty: parties.venue!, journal: store.commands, ledger, ops });
  // The web server's own `@agari/markets/games` reads (the season page, the room token, the sponsor) go to ops' arena
  // desk over the signed internal call, never to our own routes over loopback.
  registerArenaSource({
    state: async () => {
      const r = await ops.gameState();
      return r.ok ? ok(r.value, Date.now()) : err(r.diagnosis);
    },
    match: async (matchId) => {
      const r = await ops.gameMatch(matchId);
      return r.ok ? ok(r.value.view, Date.now()) : err(r.diagnosis);
    },
    season: async (seasonId) => {
      const r = await ops.gameSeason(seasonId);
      return r.ok ? ok(r.value.pool, Date.now()) : err(r.diagnosis);
    },
  });
  state = { ok: true, server: { client, ledger, tickets, games, agents, cc, desk, ops, store, parties, env: { ...env, AGARI_SEAT_COOKIE_SECRET: env.AGARI_SEAT_COOKIE_SECRET! } } };
  return state;
}

/** Tests only: drop the cached tier so a changed environment is read again. */
export function resetSeatServerForTests(): void {
  state = null;
}
