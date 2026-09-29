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
 *   sweeper    Quote_Expire                expire:<quoteCid>
 *   rebalancer VenueCash_Merge / _Split    merge:<digest>, split:<cid>
 *   netting    Leg_Merge                   net:<digest>
 *   settler    Desk_SettleBatch            settle:<digest>, residual:<cid>
 *   funding    VenueAccountInvite, Invite_Accept, VenueAccount_Credit
 *                                          invite:<digest>, account:<digest>, credit:<digest>:<leaseId>   POST /internal/seats/fund
 *   drain      Quote_Withdraw, Leg_CloseOut (venue + seat)
 *                                          withdraw:<quoteCid>, closeout:<legCid>
 *   reserve    (no writes)                 /reserve
 */
import type { SpotFeed } from "../../prices/spot";
import type { VenueDeps } from "../../runtime/deps";
import type { InternalRoutes } from "../../http/internal";
import { startExpirySweeper } from "../expiry-sweeper";
import { createLadderBoard, type LadderBoard } from "../market-maker/seat/ladder-board";
import { readPricerSettings, startPricer } from "../market-maker/seat/pricer";
import { startNetting } from "../netting";
import { startOracleFeeders } from "../price-relay/oracle-feeder";
import { startQuoteIssuer, type ShardPool } from "../quote-issuer";
import { startRebalancer } from "../rebalancer";
import { startReserveReporter, type ReserveSnapshot } from "../reserve-reporter";
import { startResolver } from "../resolver";
import { createSeatFunding } from "../seat-funding";
import { startSeatDrain } from "../seat-funding/drain";
import { startSettler } from "../settler";
import { startWindowRoller } from "../window-roller";
import { createVenueContext, type VenueContext } from "./context";

export const CANTON_ACTORS = ["roller", "oracles", "resolver", "pricer", "issuer", "sweeper", "rebalancer", "netting", "settler", "funding", "drain", "reserve"] as const;
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

  if (on("roller")) stops.push((await startWindowRoller(deps("window-roller"), venue)).stop);
  if (on("oracles")) stops.push(startOracleFeeders(venue, input.log).stop);
  if (on("resolver")) stops.push((await startResolver(input.log("resolver"), venue)).stop);
  const settings = readPricerSettings();
  if (on("pricer") && session) stops.push(startPricer({ venue: session, spot: input.spot, board, log: input.log("pricer"), settings }).stop);
  const draining = new Set<string>();
  const issuer = on("issuer") ? await startQuoteIssuer({ venue, board, log: input.log("issuer"), settings, draining }) : null;
  if (issuer) stops.push(issuer.stop);
  const pool = issuer?.pool ?? null;
  if (on("sweeper") && session) stops.push(startExpirySweeper({ venue: session, pool, log: input.log("expiry-sweeper") }).stop);
  if (on("rebalancer") && session && pool) stops.push(startRebalancer({ venue: session, pool, log: input.log("rebalancer") }).stop);
  if (on("netting") && session) stops.push(startNetting({ venue: session, pool, log: input.log("netting") }).stop);
  if (on("settler")) stops.push((await startSettler(deps("settler"), venue)).stop);
  const funding = on("funding") ? createSeatFunding({ venue, log: input.log("seat-funding") }) : null;
  if (on("drain") && session) stops.push(startSeatDrain({ venue: session, pool, log: input.log("seat-drain"), draining }).stop);
  const reserve = on("reserve") && session ? startReserveReporter({ venue: session, log: input.log("reserve-reporter") }) : null;
  if (reserve) stops.push(reserve.stop);

  const routes: InternalRoutes["routes"] = {};
  if (issuer) routes["/internal/quotes"] = issuer.handle;
  if (funding) routes["/internal/seats/fund"] = (body) => funding.handle(body);
  return {
    venue, board, pool,
    internal: { secret: input.internalSecret ?? process.env.OPS_INTERNAL_SECRET ?? null, routes },
    reserve: () => reserve?.latest() ?? null,
    stop: () => stops.forEach((s) => s()),
  };
}
