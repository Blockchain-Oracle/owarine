/**
 * price-relay (plan "Venue operations"): the process's spot feed and print archive, and on Canton the three oracle
 * feeders (Coinbase, Kraken, Bitstamp role parties posting `PriceQuote`s of 1-minute candle closes, `oracle-feeder.ts`).
 *
 * The Solana relay's signed-print pass, its Pyth update-account sweep and the attested Jupiter/PreStocks slots are gone
 * from the loop: there is no program to post to. Their source fetchers stay in this folder, dormant, for the equity
 * lanes' feeders in C6 (plan "Prices and lanes").
 */
import { createSpotFeed } from "../../prices/spot-feed";
import { createCryptoSpotFeed, joinCryptoSpot } from "../../prices/crypto-spot";
import type { SpotFeed } from "../../prices/spot";
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { createVenueContext, type VenueContext } from "../venue/context";
import { archivePass } from "./archive-pass";
import { BoundaryCache } from "./boundary-cache";
import { startOracleFeeders } from "./oracle-feeder";
import { loadRelaySources } from "./sources";

export { startOracleFeeders } from "./oracle-feeder";

export interface PriceRelayHandle {
  /** The process's spot feed (equities from Pyth/RedStone, crypto from the exchange): hand it to the pricer and HTTP. */
  spot: SpotFeed;
  stop(): void;
}

export async function startPriceRelay(deps: VenueDeps, venue: VenueContext = createVenueContext()): Promise<PriceRelayHandle> {
  const { log, sessions } = deps;
  const sources = loadRelaySources();
  const pythKey = process.env.PYTH_API_KEY || undefined;
  // S20: the valuation indices' entitlement guards every index fetch; a 403 there is recorded, never latched.
  const cache = new BoundaryCache(sources, pythKey, deps.pythIndex);
  const equity = createSpotFeed({ sources, pythKey, log: (why) => log(`[spot] ${why}`) });
  equity.start();
  const crypto = createCryptoSpotFeed({ log: (why) => log(`[crypto-spot] ${why}`) });
  crypto.start();
  const stops: Array<() => void> = [equity.stop, crypto.stop];

  const archive = { sources, cache, sessions, pythEnabled: Boolean(pythKey), entitlement: deps.pythIndex, unavailable: new Set<string>(), counters: { redstoneRows: 0, pythRows: 0, unavailable: 0 }, log };
  stops.push(runActor({ name: "price-archive", log: (why) => log(`[archive] ${why}`), dryRun: false, everyMs: 10_000, pass: () => archivePass(archive) }).stop);

  stops.push(startOracleFeeders(venue, (actor) => (why) => log(`[${actor}] ${why}`)).stop);
  log(`relay: RedStone ${sources.redstoneFeeds.length} feeds via ${sources.gateways.join(", ")}; Pyth ${pythKey ? `${sources.pythFeeds.length} trial feeds` : "off (no PYTH_API_KEY)"}; crypto spot from Coinbase; ${venue.summary}`);
  return { spot: joinCryptoSpot(equity, crypto), stop: () => stops.forEach((stop) => stop()) };
}
