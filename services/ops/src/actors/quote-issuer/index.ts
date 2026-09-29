/**
 * The quote issuer and its shard pool (plan "Venue operations": `quote.ts` becomes the issuer, an in-process FIFO over
 * K venue cash shards). `startQuoteIssuer` rebuilds the pool from the venue's active contracts at boot, keeps it in
 * step every few seconds (new change and expiry refunds join, consumed shards leave, quarantined ones resolve), and
 * returns the `POST /internal/quotes` handler. The expiry sweeper, rebalancer and netting take the same `pool`.
 */
import { diagnosis } from "@agari/core/types";
import { TEMPLATE_IDS } from "@agari/daml";
import { decodeVenueCash, pick, readActive } from "@agari/markets/ops/canton";
import { runActor } from "../../runtime/actor";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import { readPricerSettings, type PricerSettings } from "../market-maker/seat/pricer";
import type { VenueContext } from "../venue/context";
import { issueQuote, latencySummary, parseQuoteRequest } from "./issuer";
import { ShardPool } from "./pool";
import { resolveQuarantine } from "./pooled-submit";

export { latencySummary } from "./issuer";
export { ShardPool, type Lease, type Shard } from "./pool";
export { submitWithShards, venueCashCreated } from "./pooled-submit";

export interface QuoteIssuerHandle {
  pool: ShardPool;
  handle: (body: unknown) => Promise<{ status: number; body: unknown }>;
  stop: () => void;
}

export async function startQuoteIssuer(input: { venue: VenueContext; board: LadderBoard; log: (why: string) => void; settings?: PricerSettings }): Promise<QuoteIssuerHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no quotes are issued");
    return null;
  }
  const pool = new ShardPool({ venue: session.party, maxWaitMs: Number(process.env.ISSUER_MAX_WAIT_MS) || 3_000 });
  const sync = async () => pool.sync(pick(await readActive(session, [TEMPLATE_IDS.VenueCash]), TEMPLATE_IDS.VenueCash, decodeVenueCash));
  await sync();
  const s0 = pool.stats();
  input.log(`issuer as ${session.party.split("::")[0]}: pool rebuilt from the ledger, ${s0.free} shards, ${s0.totalBase} base`);
  const settings = input.settings ?? readPricerSettings();
  const infrastructure = new Set(Object.values(input.venue.parties));
  const deps = { venue: session, deskCid: input.venue.deskCid, board: input.board, pool, settings, infrastructure, log: input.log };
  const keeper = runActor({
    name: "shard-pool",
    log: input.log,
    dryRun: session.dryRun,
    everyMs: 5_000,
    pass: async () => {
      const { added, dropped } = await sync();
      const q = await resolveQuarantine(pool, session);
      const st = pool.stats();
      const lat = latencySummary();
      return {
        why: `pool ${st.free} free / ${st.inflight} in flight / ${st.quarantined} quarantined, ${st.freeBase} base free${added || dropped ? ` (+${added} −${dropped})` : ""}${q ? ` · ${q}` : ""}${lat.n ? ` · issue p50 ${lat.p50} ms p95 ${lat.p95} ms (n ${lat.n})` : ""}`,
        detail: { free: st.free, inflight: st.inflight, quarantined: st.quarantined, freeBase: st.freeBase.toString(), waiting: st.waiting, issueLatency: lat },
      };
    },
  });
  return {
    pool,
    handle: async (body) => {
      const req = parseQuoteRequest(body);
      if (typeof req === "string") return { status: 400, body: { diagnosis: diagnosis("unknown", `bad quote request: ${req}`) } };
      return issueQuote(deps, req);
    },
    stop: keeper.stop,
  };
}
