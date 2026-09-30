import type { AttributionHook, CashOutOutcome, CashOutRequest, IntentJournal, PhaseListener, StopGate, Submitter } from "@agari/core/ports";
import type { ArenaIntent } from "@agari/core/games";
import type { LeverageIntent } from "@agari/core/leverage";
import type { MakerIntent } from "@agari/core/maker";
import type { ParlayIntent } from "@agari/core/parlay";
import type { RangeIntent } from "@agari/core/range";
import type { StrategyIntent } from "@agari/core/strategies";
import type { TxOutcome, VaultIntent } from "@agari/core/ports";
import { diagnosis, type Address, type MarketId } from "@agari/core/types";
import type { ArenaPickOutcome } from "../games";
import { submitArenaPickWrite, submitArenaTx } from "../games/write";
import type { LeverageOpenOutcome } from "../leverage";
import { leverageOpenLane, leverageTxLane } from "../leverage/writes";
import { submitMakerTx } from "../maker/writes";
import type { ParlayOpenOutcome } from "../parlay";
import { parlayOpenLane, parlayTxLane } from "../parlay/writes";
import type { RangeOpenOutcome } from "../range";
import { rangeOpenLane, rangeTxLane } from "../range/writes";
import { nowMs as ledgerNowMs } from "../provider/clock";
import type { SeatSigner } from "../sessions/seat-signer";
import type { Enqueue } from "../sessions/nonce-queue";
import { cantonNotLive, notDeployed } from "../stub/not-deployed";
import type { SponsorCosigner } from "../vault";
import { noopAttribution } from "./attribution";
import { indexEvidence, type WriteEvidence } from "./evidence";
import { checkGas, type FeeLane, type GasCheck } from "./fees";
import { createMemoryJournal } from "./journal-memory";
import { chainReconcilerWith, type Reconciler } from "./recovery";
import { submitSeatCashOut, type HeldExitListener } from "./cash-out";
import { submitRestingCancel, submitSeatRest } from "./rest-lane";
import { commandVerdict, submitLegExit, submitSeatOrder } from "./seat-lane";
import { allowAllStopGate } from "./stop-gate";
import { agentsStrategyLane, agentsVaultLane } from "./agents-lane";
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
  /** One tap exits a Window's legs: its claim, or the stale refund once `refundAfter` has passed with no resolution. */
  exitLegs(o: { marketId: MarketId; mode: "claim" | "refund" }, onPhase?: PhaseListener): Promise<TxOutcome>;
  checkGas(lane: FeeLane): Promise<GasCheck>;
  /** The port's cash-out, plus the firm buy-back's held price for the surface's ring (C7a). */
  submitCashOut(request: CashOutRequest, onPhase?: PhaseListener, onHeld?: HeldExitListener): Promise<CashOutOutcome>;
}

/** A write kind no lane knows is refused; the ticket products (C8c), the arena (C9b) and the maker vault (C2d) are live. */
const PRODUCTS_NOT_LIVE = cantonNotLive("product writes");
const GRANT_ROUTE_IS_AN_AGENTS = "an order through a grant is placed by the grant's agent (ops), not from a seat's session";
/**
 * Binds every write lane to ONE seat. Orders go through the seat lane (`seat-lane.ts`: firm quote, journal, accept
 * as the seat's party, book from the created Leg); cash-outs through `cash-out.ts` (firm buy-back, journal, accept); claims and stale refunds through the legs routes. The ticket
 * products (range, parlay, boost and their Earn quotes) go through `ticket-lane.ts` (C8c), the duel through
 * `games/write.ts` (C9b), the maker vault through `maker/writes.ts` (C2d: the same Earn quotes as the ticket reserves, on
 * `reserve: "maker"`). Every write queues through `enqueue`, so one seat never races itself (and two tabs share the server's
 * per-command idempotency). A pre-open resting call and its cancel go through `rest-lane.ts` (C7c).
 */
export function createSubmitter(deps: SubmitterDeps): MarketsSubmitter {
  const { wallet, enqueue } = deps;
  const nowMs = deps.nowMs ?? ledgerNowMs;
  const journal = deps.journal ?? createMemoryJournal(nowMs);
  const stopGate = deps.stopGate ?? allowAllStopGate;
  const attribution = deps.attribution ?? noopAttribution;
  const evidence = evidenceOf(deps);
  const lane = { wallet, journal, stopGate, nowMs };
  return {
    journal,
    stopGate,
    attribution,
    wallet,
    // A browser or phone session asks our routes about its own commands; a script with its own ledger access keeps the projection reconciler.
    reconciler: deps.rpc ? chainReconcilerWith({ rpc: deps.rpc, evidence, nowMs }) : (_wallet, record) => commandVerdict(record.id),
    hasSigner: () => true,
    submitTx: (intent, onPhase) =>
      enqueue(async () => {
        // Demo cash comes from the server-side credit (`/api/faucet`, seat lease), never a seat's own write.
        if (intent.kind === "faucet") return { status: "refused" as const, diagnosis: diagnosis("faucet-refused", "demo cash is credited server-side (/api/faucet)") };
        if (intent.kind === "redeem") return submitLegExit(lane, { marketId: intent.marketId, mode: "claim" }, onPhase);
        // C7c: the seat's own resting calls, cancelled by reference; the escrow returns as venue credit (`withdraw` is not a Canton thing).
        if (intent.kind === "cancel-orders") return submitRestingCancel(lane, { marketId: intent.marketId, callRefs: intent.handles.map((h) => h.callRef) }, onPhase);
        // C8c: the ticket products and their reserves' Earn quotes.
        if (intent.kind.startsWith("range-")) return rangeTxLane(lane, intent as RangeIntent, onPhase);
        if (intent.kind.startsWith("parlay-")) return parlayTxLane(lane, intent as ParlayIntent, onPhase);
        if (intent.kind.startsWith("leverage-")) return leverageTxLane(lane, intent as LeverageIntent, onPhase);
        // C8f: grants (open, top up, revoke) and the strategy registry, through the seat's journaled agents lane.
        if (intent.kind.startsWith("vault-")) return agentsVaultLane(lane, intent as VaultIntent, onPhase);
        if (intent.kind.startsWith("strategy-")) return agentsStrategyLane(lane, intent as StrategyIntent, onPhase);
        // C9b: the duel arena (abu-pm-games) through the seat's own routes.
        if (intent.kind.startsWith("arena-")) return submitArenaTx(lane, intent as ArenaIntent, onPhase);
        // C2d: the maker vault (abu-pm-main 0.5.0): supply and withdraw quotes, and its merge / settle cranks.
        if (intent.kind.startsWith("maker-")) return submitMakerTx(lane, intent as MakerIntent, onPhase);
        return { status: "refused" as const, diagnosis: notDeployed(PRODUCTS_NOT_LIVE) };
      }),
    submitOrder: (request, onPhase) => {
      // C8f: the seat's cash IS the trading balance, so the `vault` route is the seat's own order; a `vault-grant`
      // route is an agent's, which acts through the owner's grant from ops, never from a seat's session.
      if (request.route?.kind === "vault-grant") return enqueue(async () => ({ status: "refused" as const, diagnosis: diagnosis("grant-refused", GRANT_ROUTE_IS_AN_AGENTS) }));
      // C7c: a pre-open call is the venue's offer and the seat's own place (a bilateral `RestingCall`), through `rest-lane.ts`.
      if (request.entry === "rest") return enqueue(() => submitSeatRest(lane, { ...request, route: { kind: "wallet" } }, onPhase));
      return enqueue(() => submitSeatOrder(lane, { ...request, route: { kind: "wallet" } }, onPhase));
    },
    exitLegs: (o, onPhase) => enqueue(() => submitLegExit(lane, o, onPhase)),
    submitCashOut: (request, onPhase, onHeld) => enqueue(() => submitSeatCashOut(lane, request, onPhase, onHeld)),
    submitRangeOpen: (intent, onPhase) => enqueue(() => rangeOpenLane(lane, intent, onPhase)),
    submitParlayOpen: (intent, onPhase) => enqueue(() => parlayOpenLane(lane, intent, onPhase)),
    submitLeverageOpen: (intent, onPhase) => enqueue(() => leverageOpenLane(lane, intent, onPhase)),
    submitArenaPick: (intent, onPhase) => enqueue(() => submitArenaPickWrite(lane, intent, onPhase)),
    checkGas: (lane) => checkGas(wallet, lane),
  };
}

/** The evidence a submitter reconciles with, from its deps. */
export function evidenceOf(deps: Pick<SubmitterDeps, "evidence" | "rpc">): WriteEvidence {
  return deps.evidence ?? indexEvidence(deps.rpc);
}
