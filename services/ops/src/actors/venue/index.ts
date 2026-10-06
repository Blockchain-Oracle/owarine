/**
 * The Canton venue (C3): every venue actor over one ledger client and one shard pool, started the way `main.ts` wires
 * them. Returns what the HTTP server serves: the ladder board, the `/internal/*` routes and the reserve snapshot.
 *
 *   roller     Series_OpenWindow           open:<series>:<index>, skip:<series>:<index>
 *   oracles    PriceQuote × symbols        print:<oracle>:<T>, retire:<oracle>:<digest>
 *   resolver   Terms_RecordOpen            openprint:<termsCid>
 *              Terms_Resolve / Terms_Void  resolve:<termsCid>
 *   pricer     (no writes)                 ladder per Window → /ladders/*
 *   issuer     Desk_IssueQuote             quote:<requestId>        POST /internal/quotes
 *              Desk_IssueBuyQuote          exitquote:<requestId>    POST /internal/exit-quotes
 *   sweeper    Quote_Expire, BuyQuote_Expire   expire:<quoteCid>, expirebuy:<cid>
 *   resting    RestDesk_Offer                 restoffer:<requestId>   POST /internal/resting-offers (C7c, K-235)
 *              Rest_Fill, Rest_Expire, RestOffer_Expire   restfill:<cid>:<lots>, restexp:<cid>, restoexp:<cid>
 *   rebalancer VenueCash_Merge / _Split    merge:<digest>, split:<cid>
 *   netting    Leg_Merge                   net:<digest>
 *   settler    Desk_SettleBatch            settle:<digest>, residual:<cid>
 *   funding    VenueAccountInvite, Invite_Accept, VenueAccount_Credit
 *                                          invite:<digest>, account:<digest>, credit:<digest>:<leaseId>   POST /internal/seats/fund
 *   drain      Quote_Withdraw, Leg_CloseOut (venue + seat)
 *                                          withdraw:<quoteCid>, closeout:<legCid>
 *   reserve    Maker_PublishNav            mnav:<seq>               /reserve
 *   maker      the maker vault's book (abu-pm-main 0.5.0, K-200): the issuer draws quotes inside its bounds from
 *              `reserve:maker` shards when MAKER_MODE=vault; Supply/Withdraw_Expire, VenueCash_Merge   texp:<cid>, mmerge:<digest>
 *   tickets    Book_Issue*, Nav_IssueSupply, Earn_IssueWithdraw, Boost_OfferExit   POST /internal/tickets/*
 *              Round_Settle, Ticket_ResolveLeg, Boost_Settle, Boost_KnockOut, *_Expire, Book_Prune, Earn_PublishNav (C8c)
 *   agents     GrantDesk, DeskOffer, SubscriberInvite, CreatorLicense   POST /internal/agents/enrol
 *              License_Payout (creators' aggregate fees) (C8f)
 *   games      Duel_Reveal, Duel_Lock, Duel_Score, Duel_Finalize, the three duel refunds, Season_Distribute
 *                                          duel:<step>:<digest>, season:<step>:<digest>   POST /internal/games/* (C9b)
 */
import type { SpotFeed } from "../../prices/spot";
import type { VenueDeps } from "../../runtime/deps";
import type { InternalRoutes } from "../../http/internal";
import { startExpirySweeper } from "../expiry-sweeper";
import { createLadderBoard, type LadderBoard } from "../market-maker/seat/ladder-board";
import { readPricerSettings, startPricer } from "../market-maker/seat/pricer";
import { startNetting } from "../netting";
import { startOracleFeeders } from "../price-relay/oracle-feeder";
import { laneReaderDeps, startLaneFeeders } from "../price-relay";
import { startQuoteIssuer, type ShardPool } from "../quote-issuer";
import { startRebalancer } from "../rebalancer";
import { startReserveReporter, type ReserveSnapshot } from "../reserve-reporter";
import { startResolver } from "../resolver";
import { createSeatFunding } from "../seat-funding";
import { startSeatDrain } from "../seat-funding/drain";
import { startSettler } from "../settler";
import { startTicketDesk, type TicketDeskHandle } from "../ticket-desk";
import { redeemSeatShares } from "../ticket-desk/earn";
import { startMakerVault } from "../maker-vault";
import { startArenaDesk } from "../arena-desk";
import { startRestingDesk } from "../resting-desk";
import { startWindowRoller } from "../window-roller";
import { startAgentsVenue } from "../agents";
import { startVolMeter } from "../../prices/vol-meter";
import { createVenueContext, type VenueContext } from "./context";
import { loadVenueMode } from "../../runtime/venue-mode";
import { OPS_VENUE_MODE_PATH, venueModeRoute } from "./mode-route";
import { OPS_PRIVATE_MOVE_PATH, privateMoveRoute } from "./private-route";

export const CANTON_ACTORS = ["roller", "oracles", "resolver", "pricer", "issuer", "sweeper", "rebalancer", "netting", "settler", "funding", "drain", "reserve", "tickets", "games", "agents", "maker", "resting"] as const;
export type CantonActor = (typeof CANTON_ACTORS)[number];

export interface CantonVenue {
  venue: VenueContext;
  board: LadderBoard;
  pool: ShardPool | null;
  internal: InternalRoutes;
  reserve: () => ReserveSnapshot | null;
  stop: () => void;
}

export async function startCantonVenue(input: {
  /** What every venue actor gets from main.ts; `deps.log` is replaced per actor by `log`. */
  deps: VenueDeps;
  /** The spot the pricer reads (crypto from the exchange, joined into the process feed). */
  spot: SpotFeed | null;
  log: (actor: string) => (why: string) => void;
  venue?: VenueContext;
  actors?: ReadonlySet<CantonActor>;
  /** `OPS_INTERNAL_SECRET`; null closes `/internal/*`. */
  internalSecret?: string | null;
}): Promise<CantonVenue> {
  const venue = input.venue ?? createVenueContext();
  const on = (a: CantonActor) => !input.actors || input.actors.has(a);
  const deps = (actor: string): VenueDeps => ({ ...input.deps, log: input.log(actor), spot: input.spot });
  const stops: Array<() => void> = [];
  const board = createLadderBoard();
  input.log("venue")(venue.summary);
  const session = venue.session("venue");
  // C-DAML-02: the venue mode is read once, before any actor that opens risk starts.
  await loadVenueMode(input.log("venue-mode"));

  if (on("roller")) stops.push((await startWindowRoller(deps("window-roller"), venue)).stop);
  if (on("oracles")) stops.push(startOracleFeeders(venue, input.log).stop);
  if (on("oracles")) stops.push(startLaneFeeders(venue, laneReaderDeps(input.deps), input.log).stop);
  if (on("resolver")) stops.push((await startResolver(input.log("resolver"), venue)).stop);
  const settings = readPricerSettings();
  // C6: the crypto lanes are priced only on a measured realised σ (24/7 clock), re-measured every 30 min.
  const vol = on("pricer") && session ? startVolMeter(input.log("vol-meter")) : null;
  if (vol) stops.push(vol.stop);
  if (on("pricer") && session) stops.push(startPricer({ venue: session, spot: input.spot, board, log: input.log("pricer"), settings, vol, halts: () => input.deps.halts.board() }).stop);
  const draining = new Set<string>();
  // The maker vault's book first: the issuer, the ticket desk's Earn route and the reserve reporter all take it.
  const maker = on("maker") && session ? await startMakerVault({ venue: session, log: input.log("maker-vault") }) : null;
  if (maker) stops.push(maker.stop);
  const issuer = on("issuer") ? await startQuoteIssuer({ venue, board, log: input.log("issuer"), settings, draining, maker: maker?.vault ?? null }) : null;
  if (issuer) stops.push(issuer.stop);
  const pool = issuer?.pool ?? null;
  // C7c: pre-open resting calls take the issuer's shards and its ladder board, so they start after both.
  const resting = on("resting") ? await startRestingDesk({ venue, board, pool, maker: maker?.vault ?? null, draining, log: input.log("resting-desk") }) : null;
  if (resting) stops.push(resting.stop);
  if (on("sweeper") && session) stops.push(startExpirySweeper({ venue: session, pool, log: input.log("expiry-sweeper") }).stop);
  if (on("rebalancer") && session && pool) stops.push(startRebalancer({ venue: session, pool, log: input.log("rebalancer") }).stop);
  if (on("netting") && session) stops.push(startNetting({ venue: session, pool, log: input.log("netting") }).stop);
  if (on("settler")) stops.push((await startSettler(deps("settler"), venue)).stop);
  const funding = on("funding") ? createSeatFunding({ venue, log: input.log("seat-funding") }) : null;
  // The ticket desk starts below; the drain reaches it late-bound to redeem a draining seat's Earn shares (C9d).
  let ticketDesk: TicketDeskHandle | null = null;
  const redeemShares = () => (ticketDesk ? (seat: string, shares: Parameters<typeof redeemSeatShares>[2]) => redeemSeatShares(ticketDesk!.desk, seat, shares) : null);
  if (on("drain") && session) stops.push(startSeatDrain({ venue: session, pool, log: input.log("seat-drain"), draining, redeemShares }).stop);
  const reserve = on("reserve") && session ? startReserveReporter({ venue: session, log: input.log("reserve-reporter"), maker: maker?.vault ?? null }) : null;
  if (reserve) stops.push(reserve.stop);

  const tickets = on("tickets") ? await startTicketDesk({ venue, board, pool, log: input.log("ticket-desk"), draining, maker: maker?.vault ?? null }) : null;
  ticketDesk = tickets;
  if (tickets) stops.push(tickets.stop);
  const games = on("games") ? await startArenaDesk({ venue, board, log: input.log("arena-desk") }) : null;
  if (games) stops.push(games.stop);

  const agents = on("agents") ? await startAgentsVenue({ venue, log: input.log("agents") }) : null;
  if (agents) stops.push(agents.stop);

  const routes: InternalRoutes["routes"] = {};
  if (tickets) Object.assign(routes, tickets.routes);
  if (agents) Object.assign(routes, agents.routes);
  if (games) Object.assign(routes, games.routes);
  if (issuer) routes["/internal/quotes"] = issuer.handle;
  if (issuer) routes["/internal/exit-quotes"] = issuer.handleExit;
  if (resting) routes["/internal/resting-offers"] = resting.handle;
  if (funding) routes["/internal/seats/fund"] = (body) => funding.handle(body);
  routes[OPS_VENUE_MODE_PATH] = venueModeRoute(input.log("venue-mode"));
  // C8d (L-39): the seat's private bucket, moved by the seat and the venue together.
  const privateMove = on("funding") ? privateMoveRoute(venue, input.log("private")) : null;
  if (privateMove) routes[OPS_PRIVATE_MOVE_PATH] = privateMove;
  return {
    venue, board, pool,
    internal: { secret: input.internalSecret ?? process.env.OPS_INTERNAL_SECRET ?? null, adminSecret: process.env.OPS_ADMIN_SECRET?.trim() || null, routes },
    reserve: () => reserve?.latest() ?? null,
    stop: () => stops.forEach((s) => s()),
  };
}
