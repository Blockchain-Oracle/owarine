/**
 * What every step of the desk runner shares (S21 C4, on Canton C8f): the environment, the desk queries, the
 * in-process PreStocks feed (the names' prices, practice fills and marks), the ledger reader, the operator client when
 * the agent-runner party can act, the venue's ladders (the live leg's prices), the brain, the sliding-hour call budget
 * and the mint cache (every name 9 dp, multiplier 1 on Canton). Built once in `index.ts`.
 */
import type { ResolvedModel } from "@agari/brain";
import type { DeskMandate, DeskValuation, PlannedOutcome } from "@agari/core/desk";
import type { DeskQueries, DeskRow, MandateRow, WakeTrigger } from "@agari/db";
import type { DeskMintState, DeskOperatorClient, DeskRpc, DeskState } from "@agari/markets/desk/server";
import type { Ladder } from "@agari/markets/runtime";
import type { PreStocksSpotFeed } from "../../prices/prestocks-spot";
import type { Log } from "../../runtime/actor";
import type { DeskRunnerEnv } from "./env";

/** The mint flags every desk needs, read once per refresh for all eight names. */
export interface MintCache {
  readAtSec: number;
  byMint: Record<string, DeskMintState>;
}

export interface RunnerContext {
  env: DeskRunnerEnv;
  q: DeskQueries;
  feed: PreStocksSpotFeed;
  /** The ledger reader (as the venue, read-only). */
  rpc: DeskRpc | null;
  /** The operator client (the agent-runner party); null = live desks are read and recorded, never traded. */
  operator: DeskOperatorClient | null;
  /** The venue's published ladders: the live leg's prices and Windows. */
  ladders: () => Promise<readonly Ladder[]>;
  brain: ResolvedModel | null;
  /** Why the brain is off, named for the record and the heartbeat; never a key. */
  brainMissing: string;
  /** When each model call was made, for the sliding-hour budget. */
  callsAtMs: number[];
  mints: MintCache | null;
  /** Desks holding new sends until an unknown one is reconciled by signature. */
  holding: Set<string>;
  log: Log;
  /** The party a desk owner's address leases now, or null (C4d, K-210); the lease table by default (`lease.ts`). */
  leasePartyOf?: (address: string) => Promise<string | null>;
}

/** A live desk's chain state as reconcile read it, or a practice desk's paper ledger standing in for it. */
export type DeskStanding =
  | { kind: "live"; chain: DeskState; positions: Record<string, bigint>; frozen: Record<string, boolean>; cashE6: bigint; prices: Record<string, { priceE8: bigint | null; why?: string }> }
  | { kind: "practice"; positions: Record<string, bigint>; cashE6: bigint };

export interface WakeInput {
  desk: DeskRow;
  trigger: WakeTrigger;
  scheduledForSec: number;
  wakeId: string | null;
  /** Read, value and ask exactly as a real check would, then commit nothing and send nothing. */
  dry?: boolean;
}

export interface WakeRecord {
  seq: number | null;
  hash: string | null;
  outcome: PlannedOutcome;
  summary: string;
}

export interface WakeReport {
  status: "completed" | "skipped" | "failed";
  note?: string;
  records: WakeRecord[];
  /** The paper ledger after the wake (practice desks), for the drive's print. */
  paper?: { cashE6: string; positions: Record<string, string> };
}

/** What a wake knows about its desk once reconcile and valuation are done; every later step reads it. */
export interface WakeFrame {
  desk: DeskRow;
  mandate: DeskMandate;
  mandateRow: MandateRow;
  mandateLine: string;
  standing: DeskStanding;
  valuation: DeskValuation;
  /** `active` or why not, in the record's words. */
  deskActive: boolean;
  deskStateText: string;
  /** USDC E6 counted against the caps in the owner's rolling day, grown by every action this wake confirms. */
  spentTodayE6: bigint;
  nowSec: number;
  trigger: WakeTrigger;
  scheduledForSec: number;
  wakeId: string | null;
  dry: boolean;
  say: (line: string) => void;
}
