/**
 * The owner's side of the live desk (C8f, `DeskMandate`; K-090). Reads of the seat's own desk are made AS its leased
 * party; the desk's marks, seals and a shared desk by its address are read as the venue, read-only. Every owner write
 * is submitted with `actAs` = the seat's party only, journaled by commandId and recovered from the ledger's completion
 * like `tickets.ts`. A seat without the venue's `DeskOffer` is enrolled through ops (`/internal/agents/enrol`) once.
 *
 *   open      DeskOffer_Open (the operator, caps, premium ceiling, the oracle attestors, quorum 2; no budget yet)
 *   allow     Mandate_SetAllowList (names → their 60-minute pre-IPO series)
 *   deposit   Mandate_Deposit of exactly the amount (the seat's cash is split first when no contract matches it)
 *   withdraw  Mandate_Withdraw (never blocked by the desk's state); `close` = Mandate_Close
 *   limits · mode · operator · revoke · pause · unpause   the owner's controls of the same names
 */
import { PRIVATE_BUCKET } from "@owarine/core/private";
import type { PreIpoSymbol } from "@owarine/core/market";
import { PRE_IPO_SYMBOLS } from "@owarine/core/market";
import { diagnosis, type Diagnosis } from "@owarine/core/types";
import type { DeskMode } from "@owarine/core/desk";
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@owarine/daml";
import type { Command, CreatedEvent, LedgerClient, Party } from "@owarine/ledger";
import { acmd } from "../ops/agents";
import { decodeDeskMandate, decodeDeskMark, decodeDeskOffer, type DeskMandateC, type DeskMarkC } from "../ops/agents/decode";
import { utcDayStartSec } from "../ops/agents/ids";
import { activeOf, decodeVenueCash, templateSuffix } from "../ops/canton/decode";
import { damlModeOf, DESK_GRANT_DAYS, DESK_MAX_OPEN_POSITIONS, DESK_REF_QUORUM, deskStateOf, seriesOfSymbol } from "../desk/canton";
import { createDeskLedgerRpc, findLeasedMandate, mintOf, readOwnerDeskBalances, readSealsOf } from "../desk/ops";
import type { DeskRpc, DeskState, OwnerDeskBalances, SealedAction } from "../desk/types";
import type { DeskOwnerAction, DeskWriteReply } from "../desk/wire";
import { seatCommandId } from "./ids";
import type { OpsClient } from "./ops-client";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import { exactCash } from "./exact-cash";
import { DEFAULT_COMMAND_DEADLINE_MS, inFlightBounds, type CommandJournal, type CommandRow } from "./writes";

export interface DeskSeatConfig {
  client: LedgerClient;
  /** Read-only: markets, marks and the venue's offers. Nothing is ever submitted as the venue from here. */
  venueParty: Party;
  /** The desk's operator (the agent-runner party, K-087); null = no live desks on this deployment. */
  operator: Party | null;
  /** The oracle parties whose `DeskMark`s make a desk's reference (quorum 2 of 3). */
  attestors: readonly Party[];
  journal: CommandJournal;
  ops: OpsClient;
  now?: () => number;
}

export interface DeskSeatActor {
  party: Party;
  leaseId: string;
}

interface DeskSnapshot {
  party: Party;
  offset: number;
  mandate: { cid: string; data: DeskMandateC } | null;
  offer: string | null;
  cash: { cid: string; amount: bigint }[];
}

class NotEnrolled extends Error {}

const isTemplate = (e: CreatedEvent, templateId: string) => templateSuffix(e.templateId) === templateSuffix(templateId);
const symbolOk = (s: string): s is PreIpoSymbol => (PRE_IPO_SYMBOLS as readonly string[]).includes(s);

export function createDeskSeat(cfg: DeskSeatConfig) {
  const { client, journal } = cfg;
  const now = cfg.now ?? Date.now;
  const nowSec = () => Math.floor(now() / 1000);

  async function read(party: Party): Promise<DeskSnapshot> {
    const r = await client.activeContracts({ parties: [party], templateIds: [AGENT_TEMPLATE_IDS.DeskMandate, AGENT_TEMPLATE_IDS.DeskOffer, TEMPLATE_IDS.VenueCash] });
    const snap: DeskSnapshot = { party, offset: Number(r.activeAtOffset ?? 0), mandate: null, offer: null, cash: [] };
    for (const c of r.contracts) {
      const e = c.createdEvent;
      if (isTemplate(e, AGENT_TEMPLATE_IDS.DeskMandate)) {
        const m = activeOf(e, decodeDeskMandate);
        if (m.data.owner === party && m.data.venue === cfg.venueParty) snap.mandate = m;
      } else if (isTemplate(e, AGENT_TEMPLATE_IDS.DeskOffer)) {
        const o = decodeDeskOffer(e.createArgument);
        if (o.owner === party && o.venue === cfg.venueParty) snap.offer = e.contractId;
      } else if (isTemplate(e, TEMPLATE_IDS.VenueCash)) {
        const v = decodeVenueCash(e.createArgument);
        if (v.owner === party && v.venue === cfg.venueParty && v.bucket !== PRIVATE_BUCKET) snap.cash.push({ cid: e.contractId, amount: v.amount });
      }
    }
    return snap;
  }

  /** The venue's live marks (read-only), for the desk's reference prices. */
  async function marks(): Promise<DeskMarkC[]> {
    const r = await client.activeContracts({ parties: [cfg.venueParty], templateIds: [AGENT_TEMPLATE_IDS.DeskMark] });
    return r.contracts.map((c) => decodeDeskMark(c.createdEvent.createArgument)).filter((m) => m.venue === cfg.venueParty);
  }

  /** A reader over the ledger as the venue (read-only), for a shared desk, the attach check and the seals. */
  function rpc(resolveOwner?: (address: string) => Promise<Party | null>): DeskRpc {
    return createDeskLedgerRpc({ client, venue: cfg.venueParty, readAs: [cfg.venueParty], operator: cfg.operator, ...(resolveOwner ? { resolveOwner } : {}) });
  }

  /** The seat's own desk, as the reference's `DeskState`, or null when it has none. */
  async function state(party: Party, indexMode?: DeskMode | null): Promise<DeskState | null> {
    const [snap, mk] = await Promise.all([read(party), marks()]);
    if (!snap.mandate) return null;
    return deskStateOf({ mandate: snap.mandate.data, offset: snap.offset, nowSec: nowSec(), mintOf, marks: mk, indexMode: indexMode ?? null });
  }

  /**
   * The desk an index row names, read as the venue (the desk page, shared or the owner's): only while the row's owner
   * still leases the mandate's party (`party` = that owner's CURRENT lease party, or null), and only at the row's own
   * address or, for a row written before C4d, the party's old one (`findLeasedMandate`, K-210).
   */
  async function leasedState(o: { party: Party | null; address: string }, indexMode?: DeskMode | null): Promise<DeskState | null> {
    const found = await findLeasedMandate({ client, venue: cfg.venueParty, readAs: [cfg.venueParty], operator: cfg.operator }, o);
    if (!found || found.data.venue !== cfg.venueParty) return null;
    return deskStateOf({ mandate: found.data, offset: found.offset, nowSec: nowSec(), mintOf, marks: found.marks.filter((m) => m.venue === cfg.venueParty), indexMode: indexMode ?? null });
  }

  const balances = (party: Party, symbols: readonly PreIpoSymbol[]): Promise<OwnerDeskBalances> =>
    readOwnerDeskBalances(createDeskLedgerRpc({ client, venue: cfg.venueParty, readAs: [party] }), party as never, symbols, nowSec());

  const seals = (updateId: string): Promise<SealedAction[]> => readSealsOf(rpc(), updateId as never);

  // ---- the command lane --------------------------------------------------------------------------------

  async function owned(commandId: string, actor: DeskSeatActor): Promise<CommandRow | null> {
    const row = await journal.get(commandId);
    if (row && (row.party !== actor.party || row.leaseId !== actor.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
    return row;
  }

  async function landed(row: CommandRow | null, party: Party): Promise<{ updateId: string; offset: number } | null> {
    if (!row) return null;
    const c = row.updateId ? null : await client.findAcceptedCompletion(row.commandId, [party], row.beginOffset);
    const updateId = row.updateId ?? c?.updateId ?? null;
    if (!updateId) return null;
    if (row.state !== "landed") await journal.finish(row.commandId, { state: "landed", updateId });
    return { updateId, offset: Number(c?.offset ?? row.beginOffset) };
  }

  interface Plan {
    commands: Command[];
    ctx?: RejectionContext;
  }

  async function run(actor: DeskSeatActor, journalId: string, plan: (snap: DeskSnapshot) => Plan | Promise<Plan>): Promise<DeskWriteReply> {
    const commandId = seatCommandId("agent", journalId);
    let ctx: RejectionContext = { step: "accept" };
    try {
      const prior = await owned(commandId, actor);
      if (prior && (prior.state === "landed" || prior.state === "unknown")) {
        const done = await landed(prior, actor.party);
        if (done) return { kind: "confirmed", ...done, recovered: true };
      }
      let snap = await read(actor.party);
      let p: Plan;
      try {
        p = await plan(snap);
      } catch (error) {
        if (!(error instanceof NotEnrolled)) throw error;
        const enrolled = await cfg.ops.enrolAgents({ party: actor.party, leaseId: actor.leaseId });
        if (enrolled.kind === "refused") return { kind: "refused", diagnosis: enrolled.diagnosis };
        snap = await read(actor.party);
        p = await plan(snap);
      }
      ctx = p.ctx ?? ctx;
      const row = await journal.begin({ commandId, leaseId: actor.leaseId, party: actor.party, kind: "agent", beginOffset: snap.offset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      try {
        const r = await client.submitAndWaitForTransaction({ actAs: [actor.party], commandId, commands: p.commands, ...inFlightBounds(row) });
        await journal.finish(commandId, { state: "landed", updateId: r.transaction.updateId });
        return { kind: "confirmed", updateId: r.transaction.updateId, offset: Number(r.transaction.offset), recovered: r.recovered };
      } catch (error) {
        const d = classifyRejection(error, ctx);
        const unknown = d.kind === "send-unknown";
        await journal.finish(commandId, { state: unknown ? "unknown" : "failed", diagnosis: d });
        return { kind: unknown ? "unknown" : "refused", diagnosis: d };
      }
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d: Diagnosis = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  const mandateOf = (snap: DeskSnapshot) => {
    if (!snap.mandate) throw refuse("not-deployed", "this seat has no live desk yet: open it first");
    return snap.mandate;
  };

  /** A cash contract of exactly `amount` (split, merged first if no single one covers it), before a deposit. */
  const exactCashFor = (actor: DeskSeatActor, journalId: string, amount: bigint): Promise<string> =>
    exactCash({ client, cashOf: async (party) => (await read(party)).cash }, actor.party, journalId, amount, "desk", "the deposit");

  const namesToSeries = (names: readonly string[]): string[] => {
    const bad = names.filter((n) => !symbolOk(n));
    if (bad.length) throw refuse("unknown", `not a pre-IPO company: ${bad.join(", ")}`);
    return names.map((n) => seriesOfSymbol(n as PreIpoSymbol));
  };

  /** One owner write, by action; `body` was validated by the route (`deskWriteRequestWire`). */
  async function write(actor: DeskSeatActor, action: DeskOwnerAction, body: Record<string, unknown> & { commandId: string }): Promise<DeskWriteReply> {
    const id = body.commandId;
    if (action === "deposit") {
      const amount = body.amountE6 as bigint;
      if (amount <= 0n) return { kind: "refused", diagnosis: diagnosis("invalid-price", "a deposit must be positive") };
      let cash: string;
      try {
        const snap = await read(actor.party);
        mandateOf(snap);
        cash = await exactCashFor(actor, id, amount);
      } catch (error) {
        return { kind: "refused", diagnosis: classifyRejection(error, { step: "accept" }) };
      }
      return run(actor, id, (snap) => ({ commands: [acmd.depositDesk(mandateOf(snap).cid, [cash])], ctx: { step: "accept", cashCids: [cash] } }));
    }
    return run(actor, id, (snap) => {
      const m = () => mandateOf(snap);
      switch (action) {
        case "open": {
          if (snap.mandate) throw refuse("contract-revert", "this seat already has a live desk");
          if (!snap.offer) throw new NotEnrolled();
          const operator = body.operator as string;
          if (cfg.operator && operator !== cfg.operator) throw refuse("contract-revert", "the desk's operator must be this venue's agent runner");
          if (cfg.attestors.length < DESK_REF_QUORUM) throw refuse("not-deployed", `the desk's reference needs ${DESK_REF_QUORUM} oracle parties on this deployment`);
          const perAction = body.perActionCapE6 as bigint;
          const daily = body.dailyCapE6 as bigint;
          if (perAction <= 0n || perAction > daily) throw refuse("invalid-price", "the per-action cap must be positive and at most the daily cap");
          const t = nowSec();
          return {
            commands: [acmd.openDesk(snap.offer, {
              operator, caps: { maxStakePerTrade: perAction, maxDailySpend: daily, maxPriceTicks: 0, maxOpenPositions: DESK_MAX_OPEN_POSITIONS },
              expiresAtSec: t + DESK_GRANT_DAYS * 86_400, dayZeroSec: utcDayStartSec(t), budget: 0n, cash: [], allowList: [],
              maxPremiumBps: body.maxPremiumBps as number, attestors: [...cfg.attestors], refQuorum: DESK_REF_QUORUM, mode: damlModeOf(body.mode as DeskMode),
            })],
          };
        }
        case "allow": {
          const add = namesToSeries(body.symbols as string[]);
          return { commands: [acmd.setDeskAllowList(m().cid, [...new Set([...m().data.allowList, ...add])])] };
        }
        case "disallow": {
          const [drop] = namesToSeries([body.symbol as string]);
          return { commands: [acmd.setDeskAllowList(m().cid, m().data.allowList.filter((s) => s !== drop))] };
        }
        case "withdraw": {
          const budget = m().data.grant.budget;
          const amount = (body.amountE6 as bigint | null) ?? budget;
          if (amount <= 0n || amount > budget) throw refuse("insufficient-collateral", `the desk holds ${budget} in cash; a withdrawal takes 1..that`);
          return { commands: [acmd.withdrawDesk(m().cid, amount)] };
        }
        case "limits": {
          const perAction = body.perActionCapE6 as bigint;
          const daily = body.dailyCapE6 as bigint;
          if (perAction <= 0n || perAction > daily) throw refuse("invalid-price", "the per-action cap must be positive and at most the daily cap");
          return { commands: [acmd.setDeskLimits(m().cid, { ...m().data.grant.caps, maxStakePerTrade: perAction, maxDailySpend: daily }, body.maxPremiumBps as number)] };
        }
        case "mode":
          return { commands: [acmd.setDeskMode(m().cid, damlModeOf(body.mode as DeskMode))] };
        case "operator":
          return { commands: [acmd.setDeskOperator(m().cid, body.operator as string)] };
        case "revoke":
          return { commands: [acmd.revokeDeskOperator(m().cid)] };
        case "pause":
          return { commands: [acmd.pauseDesk(m().cid, actor.party)] };
        case "unpause":
          return { commands: [acmd.unpauseDesk(m().cid)] };
        case "close":
          return { commands: [acmd.closeDesk(m().cid)] };
        default:
          throw refuse("unknown", `no desk action ${action}`);
      }
    });
  }

  return { read, state, leasedState, balances, seals, rpc, write, config: cfg };
}

export type DeskSeat = ReturnType<typeof createDeskSeat>;
