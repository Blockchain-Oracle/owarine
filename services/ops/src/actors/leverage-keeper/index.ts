/**
 * The leverage keeper on Canton (C-OPS-09): Boost and Short positions are knocked out and settled against the Window's
 * own oracle quorum. The writes are the venue's alone (`Boost_KnockOut` and `Boost_Settle` are venue-controlled), and
 * they ride the ticket desk's keeper (`ticket-desk/keeper.ts`), which leases knock-out proceeds from the same shard
 * pool as every other venue write: one writer, never two pools racing for a shard (K-262). This actor is the keeper's
 * eye: each pass it reads the Boost book as the venue, marks every position against the newest quorum print in its
 * life, and reports the knock-outs and settlements the projection recorded. It sends nothing.
 *
 * The Solana keeper it replaces cranked `leverage_settle` / `leverage_knock_out` with its own key over the markets
 * adapter; on Canton that path has no signer and no reader, so it is gone.
 */
import { TEMPLATE_IDS, TICKET_TEMPLATE_IDS } from "@agari/daml";
import { getDb } from "@agari/db";
import { decodePriceQuote, decodeTerms, pick, readActive } from "@agari/markets/ops/canton";
import { decodeBoostPosition } from "@agari/markets/ops/tickets";
import { runActor } from "../../runtime/actor";
import { createVenueContext } from "../venue/context";
import { describeBook, markBoost } from "./book";

type Log = (why: string) => void;

const EVERY_MS = 20_000;

/** Knock-outs and settlements of boosts in the last hour, from the projection's dependents (C-DAML-03). */
async function recentlyEnded(): Promise<string> {
  const db = getDb();
  if (!db) return "";
  const rows = await db<{ how: string; n: string }[]>`
    SELECT how, count(*)::text AS n FROM idx_dependents
    WHERE product IN ('boost', 'short') AND closed_ts_sec >= extract(epoch FROM now())::bigint - 3600 GROUP BY how`.catch(() => []);
  return rows.length ? ` · last hour (projection): ${rows.map((r) => `${r.how} ${r.n}`).join(", ")}` : "";
}

export async function startLeverageKeeper(log: Log): Promise<void> {
  const venue = createVenueContext().session("venue");
  if (!venue) return log("no venue party (VENUE_PARTY or the parties file): nothing to watch");
  log("watching the Boost book as the venue; knock-outs and settlements are posted by the ticket desk's keeper (one writer)");
  runActor({
    name: "leverage-keeper",
    log,
    dryRun: true,
    everyMs: EVERY_MS,
    pass: async () => {
      const acs = await readActive(venue, [TICKET_TEMPLATE_IDS.BoostPosition, TEMPLATE_IDS.MarketTerms, TEMPLATE_IDS.PriceQuote]);
      const positions = pick(acs, TICKET_TEMPLATE_IDS.BoostPosition, decodeBoostPosition);
      const terms = new Map(pick(acs, TEMPLATE_IDS.MarketTerms, decodeTerms).map((t) => [t.cid, t.data]));
      const quotes = pick(acs, TEMPLATE_IDS.PriceQuote, decodePriceQuote);
      const marks = positions.map((p) => markBoost(p, terms.get(p.data.termsCid), quotes));
      return { why: `${describeBook(marks)}${await recentlyEnded()}`, detail: { live: marks.length, knockable: marks.filter((m) => m.knockable).length } };
    },
  });
}
