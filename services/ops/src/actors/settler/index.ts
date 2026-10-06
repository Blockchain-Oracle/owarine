/**
 * settler (plan "Venue operations"): once a Window has its `Resolution`, pays every leg against it with the venue-only
 * `Desk_SettleBatch` in batches of `SETTLE_BATCH` (25): winners paid the pair, losers archived, fees recognised, voids
 * refunded backing plus fee. Users witness only their own sub-action. A batch is atomic: a leg claimed or refunded in
 * the meantime fails it with the cid named, and the settler retries without that leg; with no cid named it bisects.
 * Then any `NettedResidual` of the market is paid out (`Residual_Settle`).
 *
 * Deleted with the Solana settler: sweep, redeem-for with ATA create, release book, close ledger, close market,
 * seats and retention. The print-wait and void decisions moved to the resolver, which reuses `decide.ts`.
 */
import { TEMPLATE_IDS } from "@agari/daml";
import { getDb, openDependentSpans } from "@agari/db";
import {
  cmd, decodeLeg, decodeNettedResidual, decodeResolution, failureText, inactiveCids, isInactive, pick, readActive, refusalId, residualCommandId,
  settleBatchCommandId, submit, type ResolutionC, type RoleSession,
} from "@agari/markets/ops/canton";
import { runActor, type PassResult } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { createVenueContext, type VenueContext } from "../venue/context";
import { emitVenueEvent } from "../venue/events";
import { DEFAULT_BATCH, planBatches } from "./batches";

const MAX_BISECT_DEPTH = 6;

export interface SettleTiming {
  marketId: string;
  legs: number;
  ms: number;
}

interface SettlerState {
  venue: RoleSession;
  deskCid: () => Promise<string>;
  batchSize: number;
  resolutions: Map<string, { cid: string; data: ResolutionC }>;
  counters: { legs: number; batches: number; residuals: number; failed: number; stale: number };
  timings: SettleTiming[];
  /** Markets already alarmed about, so a stale-leg alarm is said once, not every pass. */
  alarmed: Set<string>;
  log: (why: string) => void;
}

/** Settles `legCids` in one batch; on an inactive leg retries without it, else bisects. Returns legs settled. */
async function settle(st: SettlerState, marketId: string, resolutionCid: string, legCids: string[], depth = 0): Promise<number> {
  if (legCids.length === 0) return 0;
  const started = Date.now();
  try {
    const out = await submit(st.venue, { commandId: settleBatchCommandId(resolutionCid, legCids), commands: [cmd.settleBatch(await st.deskCid(), resolutionCid, legCids)] });
    if (out.kind === "dry") {
      st.log(`${out.note} (${legCids.length} legs of ${marketId})`);
      return 0;
    }
    st.counters.batches++;
    st.timings.push({ marketId, legs: legCids.length, ms: Date.now() - started });
    if (st.timings.length > 1_000) st.timings.shift();
    return legCids.length;
  } catch (error) {
    if (isInactive(error)) {
      const gone = new Set(inactiveCids(error, legCids));
      if (gone.size > 0) return settle(st, marketId, resolutionCid, legCids.filter((c) => !gone.has(c)), depth);
    }
    if (legCids.length === 1 || depth >= MAX_BISECT_DEPTH) {
      st.counters.failed++;
      st.log(`settle ${marketId} (${legCids.length} legs) failed: ${refusalId(error) ?? ""} ${failureText(error)}`);
      return 0;
    }
    const mid = Math.ceil(legCids.length / 2);
    return (await settle(st, marketId, resolutionCid, legCids.slice(0, mid), depth + 1)) + (await settle(st, marketId, resolutionCid, legCids.slice(mid), depth + 1));
  }
}

export async function settlerPass(st: SettlerState): Promise<PassResult> {
  const acs = await readActive(st.venue, [TEMPLATE_IDS.Leg, TEMPLATE_IDS.NettedResidual]);
  const legs = pick(acs, TEMPLATE_IDS.Leg, decodeLeg).filter((l) => l.data.venue === st.venue.party);
  const residuals = pick(acs, TEMPLATE_IDS.NettedResidual, decodeNettedResidual);
  const terms = new Set([...legs.map((l) => l.data.termsCid), ...residuals.map((r) => r.data.termsCid)]);
  if ([...terms].some((t) => !st.resolutions.has(t))) {
    // Resolutions are immutable: read them only when a leg names a market not seen resolved yet.
    for (const r of pick(await readActive(st.venue, [TEMPLATE_IDS.Resolution]), TEMPLATE_IDS.Resolution, decodeResolution)) st.resolutions.set(r.data.termsCid, r);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const notes: string[] = [];
  let pending = 0;
  for (const termsCid of terms) {
    const res = st.resolutions.get(termsCid);
    const mine = legs.filter((l) => l.data.termsCid === termsCid);
    if (!res) {
      pending += mine.length;
      continue;
    }
    const live = mine.filter((l) => l.data.refundAfterSec > nowSec + 1);
    if (live.length < mine.length && !st.alarmed.has(termsCid)) {
      st.alarmed.add(termsCid);
      st.counters.stale += mine.length - live.length;
      notes.push(`ALARM ${res.data.marketId}: ${mine.length - live.length} legs past refundAfter unsettled (stale refund is the owner's)`);
    }
    if (live.length > 0) {
      const started = Date.now();
      const batches = planBatches(live, res.data, st.venue.party, st.batchSize);
      let done = 0;
      for (const b of batches) done += await settle(st, res.data.marketId, res.cid, b);
      st.counters.legs += done;
      if (done > 0) {
        const outcome = res.data.outcome === null ? `void ${res.data.voidReason?.tag ?? ""}` : res.data.outcome === "SideUp" ? "Up" : "Down";
        emitVenueEvent({ kind: "settled", marketId: res.data.marketId, legs: done, batches: batches.length, ms: Date.now() - started, atMs: Date.now() });
        notes.push(`settled ${res.data.marketId} (${outcome}): ${done} legs in ${batches.length} batches, ${Date.now() - started} ms`);
      }
    }
    for (const r of residuals.filter((x) => x.data.termsCid === termsCid)) {
      try {
        const out = await submit(st.venue, { commandId: residualCommandId(r.cid), commands: [cmd.settleResidual(r.cid, res.cid)] });
        if (out.kind === "done") st.counters.residuals++;
      } catch (error) {
        if (!isInactive(error)) notes.push(`residual ${res.data.marketId} failed: ${failureText(error)}`);
      }
    }
  }
  for (const n of notes) st.log(n);
  const c = st.counters;
  const pinned = await pinnedWindows();
  return {
    why: `${legs.length} legs open (${pending} awaiting resolution); settled ${c.legs} in ${c.batches} batches, residuals ${c.residuals}, failed ${c.failed}${pinned.text}${st.venue.dryRun ? " · DRY RUN" : ""}`,
    detail: { ...c, dependents: pinned.detail },
  };
}

/**
 * C-DAML-03: resolved Windows whose terms open products still pin, counted in the projection, never on the ledger. Legs
 * settle at once; a product settles in the ticket desk's keeper, and until it has, its Window's terms stay live (they
 * are never retired) and its price quotes are kept (`oracle-feeder` retire). The settler says how many wait.
 */
async function pinnedWindows(): Promise<{ text: string; detail: { windows: number; products: number } | null }> {
  const db = getDb();
  if (!db) return { text: "", detail: null };
  try {
    const spans = (await openDependentSpans(db)).filter((s) => s.state !== "open");
    const products = spans.reduce((n, s) => n + s.open, 0);
    return { text: spans.length ? ` · ${spans.length} resolved Window(s) still pin ${products} product(s): terms kept` : "", detail: { windows: spans.length, products } };
  } catch {
    return { text: " · dependents unreadable", detail: null };
  }
}

export const settleTimings: SettleTiming[] = [];

export async function startSettler(deps: VenueDeps, venue: VenueContext = createVenueContext()): Promise<{ stop: () => void }> {
  const session = venue.session("venue");
  if (!session) {
    deps.log("VENUE_PARTY and the parties file are missing: nothing settles");
    return runActor({ name: "settler", log: deps.log, dryRun: true, everyMs: 60_000, pass: async () => ({ why: "no venue party: scanning and reporting only" }) });
  }
  const size = Number(process.env.SETTLE_BATCH);
  const st: SettlerState = {
    venue: session, deskCid: venue.deskCid, batchSize: Number.isInteger(size) && size > 0 ? size : DEFAULT_BATCH, resolutions: new Map(),
    counters: { legs: 0, batches: 0, residuals: 0, failed: 0, stale: 0 }, timings: settleTimings, alarmed: new Set(), log: deps.log,
  };
  deps.log(`settler as ${session.party.split("::")[0]}, batches of ${st.batchSize}`);
  return runActor({ name: "settler", log: deps.log, dryRun: session.dryRun, everyMs: 3_000, pass: () => settlerPass(st) });
}
