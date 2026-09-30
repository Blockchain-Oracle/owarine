import { exchangeOfParty } from "@agari/core/proof";
import type { BacklogRow, OracleFreshRow } from "@agari/db";
import { STATUS } from "./copy";
import type { Verdict } from "./grade";
import { pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";

/**
 * `/status` rows that only exist on Canton (C5), pure over the projection's rows so the thresholds are testable:
 * each oracle's print freshness, and the resolver's and settler's backlogs. The feeders post each 1-minute close at
 * T + 10 s, so a healthy oracle's newest boundary is at most ~70 s old; the crypto lanes never close, so none of these
 * rows is session-bound.
 */
export const ORACLE_FRESH = { goodSec: 90, warnSec: 180 } as const;
/** A Window may sit a minute past its deadline (the resolver's pass) before it counts as backlog. */
export const BACKLOG_GRACE_SEC = 60;
const BACKLOG_BAD_SEC = 300;

const ladder = (value: number, good: number, warn: number): Verdict => (value <= good ? "good" : value <= warn ? "warn" : "bad");
const NAMES: Record<string, string> = { coinbase: "Coinbase", kraken: "Kraken", bitstamp: "Bitstamp" };

export function oracleRows(rows: readonly OracleFreshRow[], nowSec: number): StatusPipeline[] {
  if (rows.length === 0) return [pipelineRow("oracle:none", STATUS.pipelines.oracle("—"), { verdict: "bad", detail: STATUS.detail.oracleNone })];
  return rows.map((row) => {
    const exchange = exchangeOfParty(row.oracle);
    const name = exchange ? NAMES[exchange]! : (row.oracle.split("::")[0] ?? row.oracle);
    const id = `oracle:${exchange ?? row.oracle}`;
    if (row.last_boundary_sec === null) return pipelineRow(id, STATUS.pipelines.oracle(name), { verdict: "bad", detail: STATUS.detail.oracleNever });
    const ageSec = Math.max(0, nowSec - Number(row.last_boundary_sec));
    const recordSec = row.last_recorded_sec === null ? null : Number(row.last_recorded_sec) - Number(row.last_boundary_sec);
    return pipelineRow(id, STATUS.pipelines.oracle(name), {
      verdict: ladder(ageSec, ORACLE_FRESH.goodSec, ORACLE_FRESH.warnSec),
      lagSec: ageSec,
      detail: STATUS.detail.oracle(ageSec, recordSec, row.recent_boundaries),
    });
  });
}

export function backlogRows(b: BacklogRow, nowSec: number): StatusPipeline[] {
  const age = (sec: string | null) => (sec === null ? 0 : Math.max(0, nowSec - Number(sec)));
  const resolverAge = age(b.oldest_unresolved_deadline_sec);
  const settlerAge = age(b.oldest_unsettled_resolved_sec);
  const verdict = (n: number, ageSec: number): Verdict => (n === 0 ? "good" : ageSec > BACKLOG_BAD_SEC ? "bad" : "warn");
  return [
    pipelineRow("backlog:resolver", STATUS.pipelines.resolverBacklog, {
      verdict: verdict(b.unresolved, resolverAge),
      lagSec: b.unresolved > 0 ? resolverAge : 0,
      detail: b.unresolved === 0 ? STATUS.detail.resolverClear : STATUS.detail.resolverBacklog(b.unresolved, resolverAge),
    }),
    pipelineRow("backlog:settler", STATUS.pipelines.settlerBacklog, {
      verdict: verdict(b.unsettled, settlerAge),
      lagSec: b.unsettled > 0 ? settlerAge : 0,
      detail: b.unsettled === 0 ? STATUS.detail.settlerClear : STATUS.detail.settlerBacklog(b.unsettled, settlerAge),
    }),
  ];
}

/** What `/status` needs of the seat pool (the store's `stats`). */
export interface SeatPoolReading {
  total: number;
  free: number;
  leased: number;
  draining: number;
  oldestDrainingSinceMs: number | null;
  oldestDrainingNote: string | null;
  waitlist: number;
}

/** A seat draining this long while holding nothing it waits on (a failed check) turns the row amber. */
export const SEAT_DRAIN_STUCK_MS = 5 * 60_000;

const ageText = (ms: number): string => {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

/**
 * C9d: the guest-seat pool, counted from the pool table itself (plan §4: "the pool size is watched on /status").
 * Good while a seat is free; amber when none is (visitors wait) or when the longest-draining seat's last check failed
 * for over five minutes; red when the pool has no seat at all. A seat draining because it still holds a leg, ticket or
 * duel is normal and says so.
 */
export function seatPoolRow(s: SeatPoolReading, nowMs: number, latencyMs: number | null = null): StatusPipeline {
  const id = "seats";
  const label = STATUS.pipelines.seats;
  if (s.total === 0) return pipelineRow(id, label, { verdict: "bad", detail: STATUS.detail.seatsNone, latencyMs });
  const parts = [STATUS.detail.seats(s.total, s.free, s.leased, s.draining)];
  const since = s.oldestDrainingSinceMs;
  if (s.draining > 0) parts.push(STATUS.detail.seatsDraining(since ? ageText(nowMs - since) : null, s.oldestDrainingNote));
  if (s.waitlist > 0) parts.push(STATUS.detail.seatsWaiting(s.waitlist));
  const stuck = s.draining > 0 && since !== null && since > 0 && nowMs - since > SEAT_DRAIN_STUCK_MS && (s.oldestDrainingNote ?? "").startsWith("check failed");
  const verdict: Verdict = s.free === 0 || stuck ? "warn" : "good";
  return pipelineRow(id, label, { verdict, detail: parts.join(" · "), latencyMs });
}
