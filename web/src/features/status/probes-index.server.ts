import { formatUtc } from "@owarine/core/units";
import { cursorHead, oracleFreshness, pipelineBacklog, printArchiveStats, statusReader, type Db, type PrintArchiveStat } from "@owarine/db";
import { STATUS } from "./copy";
import { createDiagnosticRunner } from "./diagnostic-runner";
import { gradeArchive, gradeSlotLag, worst, type Verdict } from "./grade";
import { detailNumber, heartbeatOf, type OpsHealth, type OpsRead } from "./ops.server";
import { errorText, pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";
import { backlogRows, BACKLOG_GRACE_SEC, oracleRows } from "./rows-canton";
import { CADENCES, crossCheckRow, mixRows, type CheckRow, type MixRow, type PrintScope } from "./rows-prints";

/**
 * The index and archive rows of `/status` (proof-analytics.md §2.5): slots behind head, relay freshness, print-source
 * mix, cross-check agreement and the RedStone archive. One run makes at most five index-backed queries, in parallel.
 */
const diagnose = createDiagnosticRunner(10_000);
/** Consecutive spot-feed failures that turn the RedStone row amber in session. */
const SPOT_FAILING = 3;

export interface IndexProbeInput {
  db: Db | null;
  rpcSlot: number | null;
  health: OpsRead<OpsHealth>;
  /** Null when ops could not say which session prints belong to. */
  scope: PrintScope | null;
  /** Why `scope` is null. */
  scopeWhy: string;
}

export interface IndexRows {
  slotLag: StatusPipeline;
  /** Canton (C5): each oracle's freshness, then the resolver's and settler's backlogs. Not session-bound. */
  relays: StatusPipeline[];
  mixes: StatusPipeline[];
  crossCheck: StatusPipeline;
  redstone: StatusPipeline;
}

/** The projector's cursor stream (services/ops `PROJECTOR_STREAM`, default `venue`). */
const PROJECTION_STREAM = process.env.PROJECTOR_STREAM ?? "venue";

/** Every row this probe owns, answering the same failure (no database, no session scope, a failed read). */
function allDown(detail: string, latencyMs: number | null = null): Omit<IndexRows, "slotLag" | "relays"> {
  const down = (id: string, label: string) => pipelineRow(id, label, { verdict: "bad", detail, latencyMs });
  return {
    mixes: CADENCES.map((cadenceSec) => down(`mix:${cadenceSec / 60}m`, STATUS.pipelines.mix(`${cadenceSec / 60}m`))),
    crossCheck: down("cross-check", STATUS.pipelines.crossCheck),
    redstone: down("redstone", STATUS.pipelines.redstone),
  };
}

/**
 * The projector's cursor (which checkpoints advance too) against the ledger end the clock route read. Canton's crypto
 * lanes never close, so this is judged at every hour.
 */
async function slotLagRow(db: Db, ledgerEnd: number | null): Promise<StatusPipeline> {
  const label = STATUS.pipelines.slotLag;
  try {
    const { value: head, elapsedMs } = await diagnose("status:cursor", ({ step }) => step("Projector cursor", () => cursorHead(db, PROJECTION_STREAM)));
    if (head === null) return pipelineRow("slot-lag", label, { verdict: "warn", detail: STATUS.detail.slotEmpty, latencyMs: elapsedMs });
    if (ledgerEnd === null) return pipelineRow("slot-lag", label, { verdict: "bad", detail: STATUS.detail.noHead, latencyMs: elapsedMs });
    const behind = Math.max(0, ledgerEnd - Number(head.offset));
    const lastAt = formatUtc(Number(head.updated_at_ms));
    return pipelineRow("slot-lag", label, { verdict: gradeSlotLag(behind), detail: STATUS.detail.slotLag(behind, lastAt), latencyMs: elapsedMs });
  } catch (error) {
    return pipelineRow("slot-lag", label, { verdict: "bad", detail: errorText(error) });
  }
}

/** Oracle freshness and the two backlogs, over the projection. */
async function cantonRows(db: Db, nowSec: number): Promise<StatusPipeline[]> {
  try {
    const { value } = await diagnose("status:canton", ({ step }) =>
      step("Oracle prints and backlogs", () => Promise.all([oracleFreshness(db, nowSec), pipelineBacklog(db, nowSec, BACKLOG_GRACE_SEC)])),
    );
    const [oracles, backlog] = value;
    return [...oracleRows(oracles, nowSec), ...backlogRows(backlog, nowSec)];
  } catch (error) {
    const detail = errorText(error);
    return [
      pipelineRow("oracle:all", STATUS.pipelines.oracle("all"), { verdict: "bad", detail }),
      pipelineRow("backlog:resolver", STATUS.pipelines.resolverBacklog, { verdict: "bad", detail }),
      pipelineRow("backlog:settler", STATUS.pipelines.settlerBacklog, { verdict: "bad", detail }),
    ];
  }
}

function archiveReading(stats: readonly PrintArchiveStat[]): { verdict: Verdict; text: string } {
  if (stats.length === 0) return { verdict: "good", text: STATUS.detail.archiveNone };
  const evidence = {
    maxFetchLagMs: Math.max(...stats.map((stat) => stat.maxFetchLagMs)),
    minSigners: Math.min(...stats.map((stat) => stat.minSigners)),
    lateCount: stats.reduce((total, stat) => total + stat.lateCount, 0),
  };
  const fetchSec = Math.floor((evidence.maxFetchLagMs + 500) / 1000);
  return { verdict: gradeArchive(evidence), text: STATUS.detail.archive(stats.length, fetchSec, evidence.minSigners, evidence.lateCount) };
}

async function redstoneRow(scope: PrintScope, health: OpsRead<OpsHealth>): Promise<StatusPipeline> {
  const label = STATUS.pipelines.redstone;
  const offHours = !scope.inSession;
  const spot = health.ok ? heartbeatOf(health.value, "spot-feed") : null;
  const spotNote = spot && spot.failures > 0 ? STATUS.detail.spot(spot.lastWhy) : null;
  try {
    const { value, elapsedMs } = await diagnose(`status:archive:${scope.session.openSec}`, ({ step }) => step("RedStone archive", () => printArchiveStats(scope.session.openSec)));
    const archive = archiveReading((value ?? []).filter((stat) => stat.source === "redstone"));
    const text = scope.inSession ? archive.text : STATUS.detail.lastSession(scope.session.date, archive.text);
    const detail = [text, spotNote].filter(Boolean).join(" · ");
    const verdict = scope.inSession ? worst(archive.verdict, (spot?.failures ?? 0) >= SPOT_FAILING ? "warn" : "good") : "good";
    return pipelineRow("redstone", label, { verdict, detail, latencyMs: elapsedMs, offHours });
  } catch (error) {
    return pipelineRow("redstone", label, { verdict: "bad", detail: errorText(error) });
  }
}

async function printRows(db: Db, scope: PrintScope): Promise<Pick<IndexRows, "mixes" | "crossCheck">> {
  const reader = statusReader(db);
  const openSec = scope.session.openSec;
  try {
    const { value } = await diagnose(`status:prints:${openSec}`, ({ step }) =>
      step("Print mix and cross-checks", () => Promise.all([reader.printMix(openSec), reader.crossChecks(openSec)])),
    );
    const [mix, checks]: [MixRow[], CheckRow[]] = value;
    return { mixes: mixRows(mix, scope), crossCheck: crossCheckRow(checks, scope) };
  } catch (error) {
    const { mixes, crossCheck } = allDown(errorText(error));
    return { mixes, crossCheck };
  }
}

export async function probeIndex(input: IndexProbeInput): Promise<IndexRows> {
  if (!input.db) {
    const noDb = pipelineRow("oracle:all", STATUS.pipelines.oracle("all"), { verdict: "bad", detail: STATUS.detail.noDb });
    return { slotLag: pipelineRow("slot-lag", STATUS.pipelines.slotLag, { verdict: "bad", detail: STATUS.detail.noDb }), relays: [noDb], ...allDown(STATUS.detail.noDb) };
  }
  const slotLag = slotLagRow(input.db, input.rpcSlot);
  const relays = cantonRows(input.db, Math.floor(Date.now() / 1000));
  if (!input.scope) return { slotLag: await slotLag, relays: await relays, ...allDown(input.scopeWhy) };
  const [prints, redstone] = await Promise.all([printRows(input.db, input.scope), redstoneRow(input.scope, input.health)]);
  return { slotLag: await slotLag, relays: await relays, ...prints, redstone };
}

/** The relay's missed-slot counter and start, for the freshness rows. */
export function relayCounters(health: OpsRead<OpsHealth>): PrintScope["relay"] {
  if (!health.ok) return null;
  // Canton ops (K-027): the three oracle feeders are the relay; the Solana-era "price-relay" beat is read if present.
  const beats = ["oracle-coinbase", "oracle-kraken", "oracle-bitstamp"].map((n) => heartbeatOf(health.value, n)).filter((b) => b !== undefined && b !== null);
  const legacy = heartbeatOf(health.value, "price-relay");
  const all = legacy ? [legacy] : beats;
  if (all.length === 0) return null;
  const missed = all.reduce((sum, b) => sum + (detailNumber(b, "missed") ?? 0), 0);
  return { missed, startedAt: formatUtc(Math.min(...all.map((b) => b.startedMs))) };
}
