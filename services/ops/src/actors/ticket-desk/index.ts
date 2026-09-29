/**
 * The ticket desk (C8c): the venue's side of Range/Moonshot, Boost/Short, Parlay and Earn on `abu-pm-tickets`.
 *
 *   POST /internal/tickets/range   basis · preview · issue (`Book_IssueRange`)            ticket:range:<requestId>
 *   POST /internal/tickets/parlay  preview · issue (`Book_IssueParlay`)                     ticket:parlay:<requestId>
 *   POST /internal/tickets/boost   preview · issue (`Book_IssueBoost`) · exit (`Boost_OfferExit`)
 *   POST /internal/tickets/earn    supply (`Nav_IssueSupply`) · withdraw (`Earn_IssueWithdraw`)
 *   POST /internal/tickets/state   the three reserves' statements, books and liquid cash
 *   keeper                          settle · resolve legs · knock-out · expire · prune · NAV · merge (`keeper.ts`)
 *
 * Venue-only authority: every accept, claim, stale refund and liquidity accept is the seat's own, through the web.
 */
import { diagnosis } from "@agari/core/types";
import { runActor } from "../../runtime/actor";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import type { ShardPool } from "../quote-issuer/pool";
import type { VenueContext } from "../venue/context";
import { createDesk, type Desk } from "./desk";
import { handleBoost, handleEarn, handleParlay, handleRange } from "./issue";
import { keeperPass } from "./keeper";
import { navInputsOf } from "./state";
import { TICKET_RESERVES } from "@agari/markets/ops/tickets";

type Handler = (body: unknown) => Promise<{ status: number; body: unknown }>;

export interface TicketDeskHandle {
  routes: Record<string, Handler>;
  desk: Desk;
  stop: () => void;
}

export const TICKET_ROUTES = ["/internal/tickets/range", "/internal/tickets/parlay", "/internal/tickets/boost", "/internal/tickets/earn", "/internal/tickets/state"] as const;

/** The public face of the three reserves (every figure the ledger's): what `/api/ledger/tickets/state` serves. */
export function deskState(d: Desk) {
  const snap = d.snap;
  return {
    asOfMs: snap?.atMs ?? 0,
    reserves: TICKET_RESERVES.flatMap((reserveId) => {
      if (!snap) return [];
      const nav = snap.navs.get(reserveId);
      const book = snap.books.get(reserveId);
      const v = navInputsOf(snap, reserveId);
      return [{
        reserveId,
        navSeq: nav?.data.seq ?? 0,
        asOfMs: (nav?.data.asOfSec ?? 0) * 1000,
        assetsBase: nav?.data.assets ?? 0n,
        shares: nav?.data.shares ?? 0n,
        liquidBase: v.liquid,
        lockedBase: v.locked,
        bookLockedBase: (book?.data.locked ?? []).reduce((s, [, x]) => s + x, 0n),
        openTickets: v.openTickets,
        paused: !nav || !book || !snap.earnDeskCid,
      }];
    }),
  };
}

export async function startTicketDesk(input: {
  venue: VenueContext;
  board: LadderBoard;
  pool: ShardPool | null;
  log: (why: string) => void;
  draining?: ReadonlySet<string>;
  everyMs?: number;
}): Promise<TicketDeskHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no tickets are issued");
    return null;
  }
  const desk = createDesk({
    venue: session, board: input.board, venuePool: input.pool, infrastructure: new Set(Object.values(input.venue.parties)), log: input.log,
    ...(input.draining ? { draining: input.draining } : {}),
  });
  const snap = await desk.refresh();
  const ready = TICKET_RESERVES.filter((r) => snap.navs.has(r) && snap.books.has(r));
  input.log(`ticket desk as ${session.party.split("::")[0]}: reserves ${ready.join(",") || "none"}${snap.earnDeskCid ? ", EarnDesk" : ", no EarnDesk"} (bootstrap creates them)`);
  const keeper = runActor({ name: "ticket-keeper", log: input.log, dryRun: session.dryRun, everyMs: input.everyMs ?? Number(process.env.TICKET_KEEPER_MS ?? 4_000), pass: () => keeperPass(desk) });
  const guard = (h: (d: Desk, body: unknown) => Promise<{ status: number; body: unknown }>): Handler => async (body) => {
    try {
      return await h(desk, body);
    } catch (error) {
      return { status: 500, body: { diagnosis: diagnosis("unknown", error instanceof Error ? error.message : String(error)) } };
    }
  };
  return {
    desk,
    routes: {
      "/internal/tickets/range": guard(handleRange),
      "/internal/tickets/parlay": guard(handleParlay),
      "/internal/tickets/boost": guard(handleBoost),
      "/internal/tickets/earn": guard(handleEarn),
      "/internal/tickets/state": async () => ({ status: 200, body: deskState(desk) }),
    },
    stop: keeper.stop,
  };
}
