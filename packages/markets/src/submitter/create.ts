import type { AttributionHook, IntentJournal, PhaseListener, StopGate, Submitter } from "@agari/core/ports";
import type { ArenaIntent } from "@agari/core/games";
import type { LeverageIntent } from "@agari/core/leverage";
import type { ParlayIntent } from "@agari/core/parlay";
import type { RangeIntent } from "@agari/core/range";
import { diagnosis, type Address } from "@agari/core/types";
import type { ArenaPickOutcome } from "../games";
import type { LeverageOpenOutcome } from "../leverage";
import type { ParlayOpenOutcome } from "../parlay";
import type { RangeOpenOutcome } from "../range";
import { nowMs as ledgerNowMs } from "../provider/clock";
import type { SeatSigner } from "../sessions/seat-signer";
import type { Enqueue } from "../sessions/nonce-queue";
import { cantonNotLive, notDeployed } from "../stub/not-deployed";
import { refusedFor } from "../stub/product";
import type { SponsorCosigner } from "../vault";
import { noopAttribution } from "./attribution";
import { indexEvidence, type WriteEvidence } from "./evidence";
import { checkGas, type FeeLane, type GasCheck } from "./fees";
import { createMemoryJournal } from "./journal-memory";
import { chainReconcilerWith, type Reconciler } from "./recovery";
import { allowAllStopGate } from "./stop-gate";
import type { WriteRpc } from "./write-rpc";

export interface SubmitterDeps {
  /** The single seat this submitter writes for. */
  wallet: Address;
  /** The seat's signer, when the session holds one. Ledger commands are submitted server-side as the seat's party. */
  signer?: SeatSigner;
  /** Serialises sends so one seat never races itself (two tabs must not race one seat's cash). */
  enqueue: Enqueue;
  /** A server or script session's own ledger access. */
  rpc?: WriteRpc;
  /** Defaults to the projection. */
  evidence?: WriteEvidence;
  stopGate?: StopGate;
  journal?: IntentJournal;
  attribution?: AttributionHook;
  nowMs?: () => number;
  /** Kept for the session config's shape; Canton has no fee payer to co-sign (the seat pays no network fee). */
  sponsor?: SponsorCosigner;
}

/** The core Submitter plus the pre-send checks a surface needs before it asks the seat to confirm. */
export interface MarketsSubmitter extends Submitter {
  readonly journal: IntentJournal;
  readonly stopGate: StopGate;
  readonly attribution: AttributionHook;
  readonly wallet: Address;
  /** Recovery's reconciler over this session's ledger access and projection: what `recoverUnresolved` asks about open intents. */
  readonly reconciler: Reconciler;
  submitRangeOpen: (intent: Extract<RangeIntent, { kind: "range-open" }>, onPhase?: PhaseListener) => Promise<RangeOpenOutcome>;
  submitParlayOpen: (intent: Extract<ParlayIntent, { kind: "parlay-open" }>, onPhase?: PhaseListener) => Promise<ParlayOpenOutcome>;
  submitLeverageOpen: (intent: Extract<LeverageIntent, { kind: "leverage-open" }>, onPhase?: PhaseListener) => Promise<LeverageOpenOutcome>;
  submitArenaPick: (intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>, onPhase?: PhaseListener) => Promise<ArenaPickOutcome>;
  checkGas(lane: FeeLane): Promise<GasCheck>;
}

/** Every lane's reason until the Canton adapter lands (C4 orders and claims, C7a–C9 products). */
const ORDERS_NOT_LIVE = cantonNotLive("orders");
const PRODUCTS_NOT_LIVE = cantonNotLive("product writes");

/**
 * Binds every write lane to ONE seat (C1 stub, the reference's D-015 on Canton). Each lane refuses before anything is
 * journaled or signed, with the not-deployed diagnosis the surfaces already render as "Not live on this network yet".
 * The shape stays so C4 can re-point the lanes (status gate, re-quote, expiry, funding, issue quote, prepare, accept,
 * confirm, book from events) without moving a caller. Writes still queue through `enqueue`, so the per-seat ordering
 * is in place before any lane is live.
 */
export function createSubmitter(deps: SubmitterDeps): MarketsSubmitter {
  const { wallet, enqueue } = deps;
  const nowMs = deps.nowMs ?? ledgerNowMs;
  const journal = deps.journal ?? createMemoryJournal(nowMs);
  const stopGate = deps.stopGate ?? allowAllStopGate;
  const attribution = deps.attribution ?? noopAttribution;
  const evidence = evidenceOf(deps);
  const refuse = <T>(reason: string) => enqueue(async () => refusedFor(reason) as T);
  return {
    journal,
    stopGate,
    attribution,
    wallet,
    reconciler: chainReconcilerWith({ ...(deps.rpc ? { rpc: deps.rpc } : {}), evidence, nowMs }),
    hasSigner: () => true,
    submitTx: (intent) =>
      enqueue(async () =>
        // Demo cash comes from the server-side credit (`/api/faucet`, seat lease), never a seat's own write.
        intent.kind === "faucet"
          ? { status: "refused" as const, diagnosis: diagnosis("faucet-refused", "demo cash is credited server-side (/api/faucet)") }
          : { status: "refused" as const, diagnosis: notDeployed(intent.kind === "redeem" ? ORDERS_NOT_LIVE : PRODUCTS_NOT_LIVE) },
      ),
    submitOrder: () => refuse(ORDERS_NOT_LIVE),
    submitCashOut: () => refuse(ORDERS_NOT_LIVE),
    submitRangeOpen: () => refuse(PRODUCTS_NOT_LIVE),
    submitParlayOpen: () => refuse(PRODUCTS_NOT_LIVE),
    submitLeverageOpen: () => refuse(PRODUCTS_NOT_LIVE),
    submitArenaPick: () => refuse(PRODUCTS_NOT_LIVE),
    checkGas: (lane) => checkGas(wallet, lane),
  };
}

/** The evidence a submitter reconciles with, from its deps. */
export function evidenceOf(deps: Pick<SubmitterDeps, "evidence" | "rpc">): WriteEvidence {
  return deps.evidence ?? indexEvidence(deps.rpc);
}
