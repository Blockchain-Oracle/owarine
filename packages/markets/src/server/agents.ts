/**
 * The seat's side of grants and the strategy registry (C8f). Reads AS the leased party (its grants, cash, desks, book,
 * consents, licence, strategies, payouts) plus the venue's registry read-only; writes with `actAs` = the seat only,
 * journaled by the client's commandId (`agent:<uuid>`) and recovered from the ledger's completion like every other
 * seat write. Nothing is ever submitted as the venue from here: when a seat lacks one of the venue's standing offers
 * (grant desk, subscriber invitation, creator licence, desk offer), ops creates it (`/internal/agents/enrol`).
 *
 *   grants     GrantDesk_Open (cash, largest first) · GrantDesk_Fund · Grant_Revoke
 *   registry   License_Publish · Strategy_Update · Strategy_SetRunner · Strategy_Deactivate · Payout_Claim
 *   consents   Invite_OpenBook · Subscriber_Subscribe (the listing disclosed by the venue) · Subscriber_Unsubscribe
 */
import type { StrategyRecord, StrategySubscription } from "@agari/core/strategies";
import { diagnosis, type Diagnosis, type Signature } from "@agari/core/types";
import type { GrantKind, VaultCaps, VaultGrant } from "@agari/core/vault";
import { AGENT_TEMPLATE_IDS } from "@agari/daml";
import type { Command, DisclosedContract, JsTransaction, LedgerClient, Party } from "@agari/ledger";
import { acmd } from "../ops/agents";
import { grantIdOf, sha256Hex, strategyNumOf, utcDayStartSec } from "../ops/agents/ids";
import { AGENT_DECIMALS, capsToDaml, envelopeToDaml, goneGrantView, grantFor, grantIdOfC, grantKindOf, grantsByKind, grantView, strategyView, subscriptionView } from "../ops/agents/views";
import type { AgentsWriteReply } from "../provider/agents-wire";
import { readAgentsAs, readRegistry, type AgentsSnapshot, type Registry } from "./agents-read";
import { seatCommandId } from "./ids";
import type { OpsClient } from "./ops-client";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, selectCash, type CommandJournal, type CommandRow } from "./writes";

export interface AgentsSeatConfig {
  client: LedgerClient;
  /** Read-only: the venue's listings, offers and aggregate counts. Nothing is ever submitted as the venue from here. */
  venueParty: Party;
  /** The agent-runner party (house strategy runner, X executor, desk operator: K-087); null = none on this deployment. */
  agentRunner: Party | null;
  journal: CommandJournal;
  /** The venue's side: enrolling a seat's standing offers (`/internal/agents/enrol`). */
  ops: OpsClient;
  now?: () => number;
}

export interface SeatRef {
  party: Party;
  leaseId: string;
  /** The seat's base58 address: what the screens call the owner. */
  address: string;
}

/** The seat's cash and grants as the Trading Balance surfaces read them. */
export interface VaultView {
  account: { availableBase: bigint; privateAvailableBase: bigint; totalDepositedBase: bigint; totalWithdrawnBase: bigint };
  grants: Record<GrantKind, VaultGrant | null>;
  all: VaultGrant[];
  decimals: number;
}

const REGISTRY_CACHE_MS = 3_000;
/** The desk kit's X budget grant and a strategy copy both last this long unless the flow says otherwise. */
export const GRANT_MAX_DAYS = 366;

export function createAgentsSeat(cfg: AgentsSeatConfig) {
  const { client, journal } = cfg;
  const now = cfg.now ?? Date.now;
  const nowSec = () => Math.floor(now() / 1000);
  let registry: { atMs: number; value: Promise<Registry> } | null = null;

  const read = (party: Party, blobs = false) => readAgentsAs(client, party, { blobs });

  /** The venue's registry, cached a few seconds: listings, their disclosures and consent counts. */
  function venueRegistry(fresh = false): Promise<Registry> {
    if (!fresh && registry && now() - registry.atMs < REGISTRY_CACHE_MS) return registry.value;
    const value = readRegistry(client, cfg.venueParty, now());
    const entry = { atMs: now(), value };
    registry = entry;
    value.catch(() => registry === entry && (registry = null));
    return value;
  }

  // ---- reads ---------------------------------------------------------------------------------------

  async function vault(seat: SeatRef): Promise<VaultView> {
    const snap = await read(seat.party);
    const t = nowSec();
    const all = snap.grants.filter((g) => g.data.owner === seat.party).map((g) => grantView(g.data, t, seat.address));
    return {
      account: { availableBase: snap.cash.reduce((s, c) => s + c.amount, 0n), privateAvailableBase: 0n, totalDepositedBase: 0n, totalWithdrawnBase: 0n },
      grants: grantsByKind(all),
      all,
      decimals: AGENT_DECIMALS,
    };
  }

  /** One of the seat's grants by id: live, or gone (a grant leaves the ledger only by its owner's revoke). */
  async function grant(seat: SeatRef, grantId: bigint): Promise<VaultGrant | null> {
    const snap = await read(seat.party);
    const live = snap.grants.find((g) => g.data.owner === seat.party && grantIdOfC(g.data) === grantId);
    return live ? grantView(live.data, nowSec(), seat.address) : null;
  }

  /** The public registry; a creator who holds a lease is shown by its seat address (`labels`). */
  async function strategies(labels: ReadonlyMap<string, string> = new Map()): Promise<StrategyRecord[]> {
    const r = await venueRegistry();
    return r.entries.map((e) => strategyView(e.listing.data, e.strategy?.data ?? null, e.subscribers, { creator: labels.get(e.listing.data.creator) ?? e.listing.data.creator }));
  }

  async function subscriptions(seat: SeatRef, ids: readonly bigint[]): Promise<StrategySubscription[]> {
    const snap = await read(seat.party);
    const want = new Set(ids.map(String));
    const t = nowSec();
    const mine = snap.grants.filter((g) => g.data.owner === seat.party).map((g) => g.data);
    return snap.subscriptions
      .filter((s) => s.data.subscriber === seat.party)
      .map((s) => subscriptionView(s.data, grantFor(mine, seat.party, s.data.runner, t), t, s.createdAtSec, seat.address))
      .filter((s) => want.size === 0 || want.has(s.strategyId.toString()));
  }

  // ---- the command lane ------------------------------------------------------------------------------

  interface Plan {
    commands: Command[];
    disclosed?: DisclosedContract[];
    deadlineMs?: number;
    ctx?: RejectionContext;
  }

  async function owned(commandId: string, seat: SeatRef): Promise<CommandRow | null> {
    const row = await journal.get(commandId);
    if (row && (row.party !== seat.party || row.leaseId !== seat.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
    return row;
  }

  async function landed(row: CommandRow | null, party: Party): Promise<string | null> {
    if (!row) return null;
    const updateId = row.updateId ?? (await client.findAcceptedCompletion(row.commandId, [party], row.beginOffset))?.updateId ?? null;
    if (updateId && row.state !== "landed") await journal.finish(row.commandId, { state: "landed", updateId });
    return updateId;
  }

  const confirmed = (updateId: string, recovered: boolean): AgentsWriteReply => ({ kind: "confirmed", updateId: updateId as Signature, recovered });

  /** One seat command, journaled first, recovered by its id; a missing venue offer is enrolled once, then planned again. */
  async function run(seat: SeatRef, journalId: string, plan: (snap: AgentsSnapshot) => Plan | Promise<Plan>): Promise<AgentsWriteReply> {
    const commandId = seatCommandId("agent", journalId);
    let ctx: RejectionContext = { step: "accept" };
    try {
      const prior = await owned(commandId, seat);
      if (prior && (prior.state === "landed" || prior.state === "unknown")) {
        const done = await landed(prior, seat.party);
        if (done) return confirmed(done, true);
      }
      let snap = await read(seat.party, true);
      let p: Plan;
      try {
        p = await plan(snap);
      } catch (error) {
        if (!(error instanceof NotEnrolled)) {
          const done = await landed(prior, seat.party);
          if (done) return confirmed(done, true);
          throw error;
        }
        const enrolled = await cfg.ops.enrolAgents({ party: seat.party, leaseId: seat.leaseId });
        if (enrolled.kind === "refused") return { kind: "refused", diagnosis: enrolled.diagnosis };
        snap = await read(seat.party, true);
        p = await plan(snap);
      }
      ctx = p.ctx ?? ctx;
      await journal.begin({ commandId, leaseId: seat.leaseId, party: seat.party, kind: "agent", beginOffset: snap.offset, deadlineMs: p.deadlineMs ?? now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      let tx: JsTransaction;
      let recovered: boolean;
      try {
        const r = await client.submitAndWaitForTransaction({ actAs: [seat.party], commandId, commands: p.commands, ...(p.disclosed?.length ? { disclosedContracts: p.disclosed } : {}) });
        tx = r.transaction;
        recovered = r.recovered;
      } catch (error) {
        const d = classifyRejection(error, ctx);
        const state = d.kind === "send-unknown" ? "unknown" : "failed";
        await journal.finish(commandId, { state, diagnosis: d });
        return state === "unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
      }
      await journal.finish(commandId, { state: "landed", updateId: tx.updateId });
      registry = null;
      return confirmed(tx.updateId, recovered);
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d: Diagnosis = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  const pay = (snap: AgentsSnapshot, amount: bigint): string[] => {
    const picked = selectCash(snap.cash, amount);
    if (!picked) throw refuse("insufficient-collateral", `the seat holds ${snap.cash.reduce((s, c) => s + c.amount, 0n)} and this needs ${amount}`);
    return picked;
  };
  const grantDesk = (snap: AgentsSnapshot) => {
    const d = snap.grantDesks[0];
    if (!d) throw new NotEnrolled();
    return d.cid;
  };
  const liveGrant = (snap: AgentsSnapshot, grantId: bigint) => {
    const g = snap.grants.find((x) => x.data.owner === snap.party && grantIdOfC(x.data) === grantId);
    if (!g) throw refuse("grant-refused", `grant #${grantId} is not live for this seat (revoked, or never opened)`);
    return g;
  };
  const entryOf = async (strategyId: bigint) => {
    const r = await venueRegistry(true);
    const e = r.byNum.get(strategyId.toString());
    if (!e) throw refuse("market-not-trading", `strategy #${strategyId} is not on the registry`);
    return e;
  };

  // ---- grants --------------------------------------------------------------------------------------

  /** A grant funded from the seat's cash. One live grant per kind (the reference's slots): replace means revoke first. */
  function openGrant(seat: SeatRef, o: { journalId: string; kind: GrantKind; actor: string; caps: VaultCaps; expiresAtSec: number; budgetBase: bigint }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      if (o.kind === "session") throw refuse("grant-refused", "a seat already trades in one tap: there is no session key to grant on Canton");
      if (o.budgetBase <= 0n) throw refuse("invalid-price", "a grant's budget must be positive");
      const t = nowSec();
      if (o.expiresAtSec <= t || o.expiresAtSec > t + GRANT_MAX_DAYS * 86_400) throw refuse("grant-refused", "a grant expires between now and a year from now");
      const caps = capsToDaml(o.caps);
      const kind = grantKindOf({ caps });
      if (kind !== o.kind) throw refuse("grant-refused", o.kind === "executor" ? "an X grant carries no monetary cap and no price cap" : "a strategy grant needs its own caps");
      if (caps.maxStakePerTrade <= 0n || caps.maxDailySpend <= 0n || caps.maxOpenPositions <= 0) throw refuse("invalid-price", "caps must be positive");
      const held = snap.grants.find((g) => g.data.owner === seat.party && grantKindOf(g.data) === kind && g.data.expiresAtSec >= t);
      if (held) throw refuse("grant-refused", `this seat already holds a live ${kind} grant (#${grantIdOfC(held.data)}): revoke it first`);
      const desk = grantDesk(snap);
      return {
        commands: [acmd.openGrant(desk, { agent: o.actor, caps, expiresAtSec: o.expiresAtSec, dayZeroSec: utcDayStartSec(t), budget: o.budgetBase, cash: pay(snap, o.budgetBase) })],
        ctx: { step: "accept", cashCids: [] },
      };
    });
  }

  /** Add to a live grant's budget from the seat's cash; its day, spend, positions, caps and expiry stay. */
  function fundGrant(seat: SeatRef, o: { journalId: string; grantId: bigint; amountBase: bigint }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      if (o.amountBase <= 0n) throw refuse("invalid-price", "a top-up must add cash");
      const g = liveGrant(snap, o.grantId);
      return { commands: [acmd.fundGrant(grantDesk(snap), g.cid, pay(snap, o.amountBase))], ctx: { step: "accept", quoteCid: g.cid } };
    });
  }

  /** Revoke: the whole remaining budget comes back as cash, expired or not. */
  function revokeGrant(seat: SeatRef, o: { journalId: string; grantId: bigint }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      const g = liveGrant(snap, o.grantId);
      return { commands: [acmd.revokeGrant(g.cid)], ctx: { step: "claim", legCids: [g.cid] } };
    });
  }

  // ---- the registry --------------------------------------------------------------------------------

  /** Seal and list a strategy under the seat's creator licence. `runner` is a party (the house runner or the seat itself). */
  function publish(seat: SeatRef, o: { journalId: string; runner: string; envelope: VaultCaps; feeBase: bigint; metadata: string }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      const lic = snap.licenses[0];
      if (!lic) throw new NotEnrolled();
      const runner = o.runner === seat.address ? seat.party : o.runner;
      if (runner === cfg.venueParty) throw refuse("grant-refused", "the venue cannot run a strategy");
      const envelope = envelopeToDaml(o.envelope);
      if (envelope.maxStakePerTrade <= 0n || envelope.maxDailySpend <= 0n || envelope.maxOpenPositions <= 0) throw refuse("invalid-price", "an envelope needs a stake, a daily and a position ceiling");
      return { commands: [acmd.publishStrategy(lic.cid, { runner, envelope, fee: o.feeBase, spec: o.metadata, specHash: sha256Hex(o.metadata) })] };
    });
  }

  /** The creator's own Strategy and the venue's listing of it (both must be live). */
  const creatorPair = async (snap: AgentsSnapshot, strategyId: bigint) => {
    const e = await entryOf(strategyId);
    if (e.listing.data.creator !== snap.party) throw refuse("grant-refused", "only the strategy's creator may change it");
    const s = snap.strategies.find((x) => x.data.strategyId === e.listing.data.strategyId);
    if (!s || !e.listing.cid) throw refuse("contract-revert", "the strategy or its listing is not live");
    return { strategyCid: s.cid, listingCid: e.listing.cid, listing: e.listing.data };
  };

  function update(seat: SeatRef, o: { journalId: string; strategyId: bigint; metadata: string; feeBase: bigint }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, async (snap) => {
      const p = await creatorPair(snap, o.strategyId);
      return { commands: [acmd.updateStrategy(p.strategyCid, p.listingCid, o.metadata, sha256Hex(o.metadata), o.feeBase)] };
    });
  }

  function setRunner(seat: SeatRef, o: { journalId: string; strategyId: bigint; runner: string }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, async (snap) => {
      const p = await creatorPair(snap, o.strategyId);
      const runner = o.runner === seat.address ? seat.party : o.runner;
      return { commands: [acmd.setRunner(p.strategyCid, p.listingCid, runner)] };
    });
  }

  function deactivate(seat: SeatRef, o: { journalId: string; strategyId: bigint }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, async (snap) => {
      const p = await creatorPair(snap, o.strategyId);
      return { commands: [acmd.deactivateStrategy(p.strategyCid, p.listingCid)] };
    });
  }

  /**
   * Consent to be traded for (copy or mirror by the spec, fade when asked), through the seat's grant `grantId` to the
   * strategy's runner. The book of consents is opened in the same command when the seat has none yet. The fee the
   * seat was shown is the most it pays (a raised fee is refused on the ledger, not paid).
   */
  function subscribe(seat: SeatRef, o: { journalId: string; strategyId: bigint; grantId: bigint; feeBase: bigint; fade: boolean }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, async (snap) => {
      const e = await entryOf(o.strategyId);
      if (!e.listing.cid || !e.disclosure) throw refuse("contract-revert", "the strategy's listing could not be disclosed");
      const g = liveGrant(snap, o.grantId);
      const preset = e.strategy ? presetOf(e.strategy.data.spec) : null;
      const kind = o.fade ? "SubFade" : preset === "mirror" ? "SubMirror" : "SubCopy";
      const cash = e.listing.data.fee > 0n ? pay(snap, e.listing.data.fee) : [];
      const sub = { listingCid: e.listing.cid, grantCid: g.cid, kind, maxFee: o.feeBase, expectVersion: e.listing.data.version, cash } as const;
      const book = snap.books[0];
      if (book) return { commands: [acmd.subscribe(book.cid, sub)], disclosed: [e.disclosure], ctx: { step: "accept", cashCids: cash } };
      const invite = snap.invites[0];
      if (!invite) throw new NotEnrolled();
      // The book does not exist yet: open it, then subscribe in a second command of the same transaction is not
      // possible (the new book's id is not known), so the book is opened first under its own command id.
      await client.submitAndWaitForTransaction({ actAs: [seat.party], commandId: `agent-book:${seat.leaseId}`, commands: [acmd.openBook(invite.cid)] });
      const fresh = await read(seat.party);
      const opened = fresh.books[0];
      if (!opened) throw refuse("contract-revert", "the subscriber book did not open");
      return { commands: [acmd.subscribe(opened.cid, { ...sub, cash: e.listing.data.fee > 0n ? pay(fresh, e.listing.data.fee) : [] })], disclosed: [e.disclosure], ctx: { step: "accept" } };
    });
  }

  function unsubscribe(seat: SeatRef, o: { journalId: string; strategyId: bigint; fade: boolean }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      const book = snap.books[0];
      const sub = snap.subscriptions.find((s) => s.data.subscriber === seat.party && strategyNumOf(s.data.strategyId) === o.strategyId && (s.data.kind === "SubFade") === o.fade);
      if (!book || !sub) throw refuse("already-claimed", `this seat holds no ${o.fade ? "fade" : "copy"} consent for strategy #${o.strategyId}`);
      return { commands: [acmd.unsubscribe(book.cid, sub.cid)], ctx: { step: "claim", legCids: [sub.cid] } };
    });
  }

  /** The creator claims every aggregate payout the venue made it. */
  function claimPayouts(seat: SeatRef, o: { journalId: string }): Promise<AgentsWriteReply> {
    return run(seat, o.journalId, (snap) => {
      if (snap.payouts.length === 0) throw refuse("already-claimed", "no creator payout is waiting");
      return { commands: snap.payouts.map((p) => acmd.claimPayout(p.cid)), ctx: { step: "claim" } };
    });
  }

  /** Whether the party still holds a desk (drain closes it before the seat is recycled). */
  async function hasDesk(party: Party): Promise<boolean> {
    const r = await client.activeContracts({ parties: [party], templateIds: [AGENT_TEMPLATE_IDS.DeskMandate] });
    return r.contracts.some((c) => (c.createdEvent.createArgument as { owner?: unknown }).owner === party);
  }

  return { read, hasDesk, venueRegistry, vault, grant, strategies, subscriptions, openGrant, fundGrant, revokeGrant, publish, update, setRunner, deactivate, subscribe, unsubscribe, claimPayouts };
}

export type AgentsSeat = ReturnType<typeof createAgentsSeat>;

class NotEnrolled extends Error {
  constructor() {
    super("the seat has no standing offer for agents yet");
  }
}

/** The preset a sealed metadata text names, or null when it does not parse. */
function presetOf(metadata: string): string | null {
  try {
    const m = JSON.parse(metadata) as { spec?: { preset?: unknown } };
    return typeof m.spec?.preset === "string" ? m.spec.preset : null;
  } catch {
    return null;
  }
}

/** A gone grant as the screens read it (revoked), for `getVaultGrant` of an id the seat no longer holds. */
export const revokedGrant = (grantId: bigint, owner: string, actor: string): VaultGrant => goneGrantView(grantId, owner, actor);

export const agentsRefusal = (kind: Diagnosis["kind"], technical: string): AgentsWriteReply => ({ kind: "refused", diagnosis: diagnosis(kind, technical) });

/** The id a grant will carry once opened (for a client that wants to name it before the read). */
export const expectedGrantId = (owner: string, agent: string, expiresAtSec: number, nowSec: number): bigint => grantIdOf({ owner, agent, expiresAtSec, dayZeroSec: utcDayStartSec(nowSec) });
