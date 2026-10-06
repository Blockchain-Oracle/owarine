/**
 * The seat's side of the Canton Coin path (C7b). Reads AS the leased party (its allowance, receipts, requests, cash and
 * token-standard holdings) plus the venue's listing and latest reserve statement read-only; writes with `actAs` = the
 * seat only, journaled by the client's commandId like every other seat write. Nothing is ever submitted as the venue
 * from here: the venue answers a request through its own ops actor (`services/ops` `cc-rail`).
 *
 * The path is gated on `CC_RAIL_CAPABILITY` (`@agari/core/cc`), `not-live` in code until DevNet proves it. While it is,
 * `status` says so and why, and every write refuses before anything is journaled or signed. A seat's reads count only
 * what was created at or after its lease's start offset (K-224): an allowance, receipt or request on the same party
 * from an earlier visitor is not this seat's.
 */
import { PRIVATE_BUCKET } from "@agari/core/private";
import { CC_RAIL_WAITING_ON, type CcRailCapability, type CcRailView } from "@agari/core/cc";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { CC_TEMPLATE_IDS, CIP56_INTERFACE_IDS, TEMPLATE_IDS } from "@agari/daml";
import { UnitsError, atomicToCashUnitsExact, cashUnitsToCc, ccToAtomic, type ContractId, type JsTransaction, type LedgerClient, type Party } from "@agari/ledger";
import { readCip56Holdings } from "../holdings/reader";
import { ccCmd, coverHoldings, decodeAllowance, decodeDeposit, decodeHoldingView, decodeListing, decodeProposal, decodeStatement, decodeWithdrawal, interfaceViewOf, RegistryError, type RegistryClient } from "../ops/cc";
import { decodeVenueCash, templateSuffix } from "../ops/canton/decode";
import type { CcWriteReply } from "../provider/cc-wire";
import { seatCommandId } from "./ids";
import { classifyRejection, refuse, SeatRefusal, type RejectionContext } from "./rejection";
import { DEFAULT_COMMAND_DEADLINE_MS, inFlightBounds, type CommandJournal } from "./writes";
import type { SeatRef } from "./agents";

export interface CcSeatConfig {
  client: LedgerClient;
  /** Read-only: the venue's listing and its latest reserve statement. Nothing is ever submitted as the venue from here. */
  venueParty: Party;
  journal: CommandJournal;
  listingId: string;
  capability: CcRailCapability;
  /** The token registry's client, for the seat's deposit instruction; null = none configured, so a deposit refuses. */
  registry?: RegistryClient | null;
  /** How long a deposit the seat instructs stays open for the venue to accept. */
  transferWindowSec?: number;
  now?: () => number;
}

const RAIL = [CC_TEMPLATE_IDS.CcAllowance, CC_TEMPLATE_IDS.CcDeposit, CC_TEMPLATE_IDS.CcWithdrawal, CC_TEMPLATE_IDS.CcWithdrawProposal, TEMPLATE_IDS.VenueCash] as const;
const is = (templateId: string, want: string) => templateSuffix(templateId) === templateSuffix(want);

/** How long a withdrawal ask the seat signs stays answerable. */
const ASK_STANDS_SEC = 3_600;

const NOT_LIVE = `The Canton Coin path is not live: waiting on ${CC_RAIL_WAITING_ON}.`;

export function createCcSeat(cfg: CcSeatConfig) {
  const { client, journal } = cfg;
  const now = cfg.now ?? Date.now;

  async function venueView() {
    const acs = (await client.activeContracts({ parties: [cfg.venueParty], templateIds: [CC_TEMPLATE_IDS.CcListing, CC_TEMPLATE_IDS.CcReserveStatement], maxPageSize: 200 })).contracts;
    let listing: ReturnType<typeof decodeListing> | null = null;
    let statement: ReturnType<typeof decodeStatement> | null = null;
    for (const c of acs) {
      // Only what the venue itself signed: a stranger can name the venue an observer of a look-alike listing or statement.
      if (!c.createdEvent.signatories.includes(cfg.venueParty)) continue;
      try {
        if (is(c.createdEvent.templateId, CC_TEMPLATE_IDS.CcListing)) {
          const l = decodeListing(c.createdEvent.createArgument);
          if (l.listingId === cfg.listingId && l.venue === cfg.venueParty) listing = l;
        } else if (is(c.createdEvent.templateId, CC_TEMPLATE_IDS.CcReserveStatement)) {
          const s = decodeStatement(c.createdEvent.createArgument);
          if (s.venue === cfg.venueParty && s.listingId === cfg.listingId && (!statement || s.seq > statement.seq)) statement = s;
        }
      } catch {
        /* a payload this build cannot read is not the rail's */
      }
    }
    return { listing, statement };
  }

  /** The seat's Canton Coin path: never throws on an empty seat; a failed read is the caller's to report (`status` rejects). */
  async function status(seat: SeatRef): Promise<CcRailView> {
    const [venue, mine, coin] = await Promise.all([
      venueView(),
      client.activeContracts({ parties: [seat.party], templateIds: [...RAIL], maxPageSize: 500 }),
      client.activeContracts({ parties: [seat.party], interfaceIds: [CIP56_INTERFACE_IDS.Holding], maxPageSize: 500 }),
    ]);
    const view: CcRailView = {
      capability: cfg.capability,
      reason: null,
      listing: venue.listing && {
        listingId: venue.listing.listingId, instrumentAdmin: venue.listing.instrumentAdmin, instrumentId: venue.listing.instrumentId,
        unitsPerCoin: venue.listing.unitsPerCoin.toString(), minDepositUnits: venue.listing.minDepositUnits.toString(),
        maxDepositUnits: venue.listing.maxDepositUnits.toString(), depositsOpen: venue.listing.depositsOpen,
      },
      allowanceUnits: "0",
      cashUnits: "0",
      holdings: [],
      deposits: [],
      withdrawals: [],
      proposals: [],
      reserve: venue.statement && { covered: venue.statement.covered, asOfSec: venue.statement.asOfSec, heldUnits: venue.statement.heldUnits.toString(), liabilityUnits: venue.statement.liabilityUnits.toString() },
    };
    let allowance = 0n;
    let cash = 0n;
    for (const c of mine.contracts) {
      const e = c.createdEvent;
      // K-224: a record on this party from before the lease began is an earlier visitor's. Cash is the party's.
      const own = e.offset >= seat.fromOffset;
      // Every rail record is the venue's, except the seat's own ask, which the seat signed: a stranger can name the seat an
      // observer of a look-alike with any numbers on it, but cannot sign as the venue or as the seat.
      const signer = is(e.templateId, CC_TEMPLATE_IDS.CcWithdrawProposal) ? seat.party : cfg.venueParty;
      if (!e.signatories.includes(signer)) continue;
      try {
        if (is(e.templateId, TEMPLATE_IDS.VenueCash)) {
          const x = decodeVenueCash(e.createArgument);
          if (x.owner === seat.party && x.venue === cfg.venueParty && x.bucket !== PRIVATE_BUCKET) cash += x.amount;
        } else if (own && is(e.templateId, CC_TEMPLATE_IDS.CcAllowance)) {
          const a = decodeAllowance(e.createArgument);
          if (a.owner === seat.party && a.venue === cfg.venueParty && a.listingId === cfg.listingId) allowance += a.units;
        } else if (own && is(e.templateId, CC_TEMPLATE_IDS.CcDeposit)) {
          const d = decodeDeposit(e.createArgument);
          if (d.owner === seat.party && d.venue === cfg.venueParty) view.deposits.push({ units: d.units.toString(), receivedAtomic: d.receivedAtomic.toString(), settledAtSec: d.settledAtSec, ref: d.ref });
        } else if (own && is(e.templateId, CC_TEMPLATE_IDS.CcWithdrawal)) {
          const w = decodeWithdrawal(e.createArgument);
          if (w.owner === seat.party && w.venue === cfg.venueParty) {
            const state = w.state === "WdSent" ? "sent" : w.state === "WdCompleted" ? "completed" : "refunded";
            view.withdrawals.push({ units: w.units.toString(), sentAtomic: w.sentAtomic.toString(), state, openedAtSec: w.openedAtSec, ref: w.ref });
          }
        } else if (own && is(e.templateId, CC_TEMPLATE_IDS.CcWithdrawProposal)) {
          const p = decodeProposal(e.createArgument);
          if (p.owner === seat.party && p.venue === cfg.venueParty) view.proposals.push({ units: p.units.toString(), ref: p.ref });
        }
      } catch {
        /* skip a payload this build cannot read */
      }
    }
    view.allowanceUnits = allowance.toString();
    view.cashUnits = cash.toString();
    const totals = new Map<string, { instrumentAdmin: string; instrumentId: string; unlocked: bigint; locked: bigint }>();
    for (const c of coin.contracts) {
      const raw = interfaceViewOf(c.createdEvent, CIP56_INTERFACE_IDS.Holding);
      if (!raw) continue;
      try {
        const h = decodeHoldingView(raw);
        if (h.owner !== seat.party) continue; // a transfer offered to the seat shows as a locked holding of its sender
        if (!c.createdEvent.signatories.includes(h.instrumentAdmin)) continue; // a look-alike the instrument's admin did not sign
        const key = `${h.instrumentAdmin}\n${h.instrumentId}`;
        const t = totals.get(key) ?? { instrumentAdmin: h.instrumentAdmin, instrumentId: h.instrumentId, unlocked: 0n, locked: 0n };
        if (h.lock) t.locked += h.amountAtomic;
        else t.unlocked += h.amountAtomic;
        totals.set(key, t);
      } catch {
        /* likewise */
      }
    }
    view.holdings = [...totals.values()].map((t) => ({ instrumentAdmin: t.instrumentAdmin, instrumentId: t.instrumentId, unlockedAtomic: t.unlocked.toString(), lockedAtomic: t.locked.toString() }));
    view.reason = cfg.capability === "not-live" ? NOT_LIVE : !view.listing ? "The venue has not listed Canton Coin yet." : !view.listing.depositsOpen ? "The venue is not taking new Canton Coin deposits." : null;
    return view;
  }

  const notLive = (): Diagnosis => diagnosis("not-deployed", NOT_LIVE);

  /**
   * The seat's ask: `units` of its cash back in coin. Checked here before anything is signed (the ledger refuses the same
   * things again at the venue's answer): the path is live, the listing exists, the amount converts exactly and is inside
   * the rail's bounds, the seat has that much coin owed to it and that much cash, and no earlier ask is still waiting.
   */
  async function requestWithdraw(seat: SeatRef, o: { journalId: string; units: bigint }): Promise<CcWriteReply> {
    if (cfg.capability !== "live") return { kind: "refused", diagnosis: notLive() };
    const commandId = seatCommandId("ccwithdraw", o.journalId);
    const ctx: RejectionContext = { step: "ccwithdraw" };
    try {
      const prior = await journal.get(commandId);
      if (prior && (prior.party !== seat.party || prior.leaseId !== seat.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
      if (prior && (prior.state === "landed" || prior.state === "unknown")) {
        const updateId = prior.updateId ?? (await client.findAcceptedCompletion(prior.commandId, [seat.party], prior.beginOffset))?.updateId ?? null;
        if (updateId) {
          if (prior.state !== "landed") await journal.finish(commandId, { state: "landed", updateId });
          return { kind: "requested", updateId, recovered: true };
        }
      }
      const view = await status(seat);
      if (!view.listing) throw refuse("not-deployed", "the venue has not listed Canton Coin");
      const unitsPerCoin = BigInt(view.listing.unitsPerCoin);
      const listingNow = view.listing;
      try {
        cashUnitsToCc(o.units, unitsPerCoin);
      } catch (error) {
        if (error instanceof UnitsError) throw refuse("invalid-price", "that amount is outside what the Canton Coin path converts");
        throw error;
      }
      if (o.units > BigInt(view.allowanceUnits)) throw refuse("insufficient-collateral", "only coin you deposited and have not taken back can be withdrawn");
      if (o.units > BigInt(view.cashUnits)) throw refuse("insufficient-collateral", "your cash does not cover this withdrawal");
      if (view.proposals.length > 0) throw refuse("grant-refused", "an earlier Canton Coin withdrawal is still waiting for the venue");
      const beginOffset = await client.ledgerEnd();
      const row = await journal.begin({ commandId, leaseId: seat.leaseId, party: seat.party, kind: "ccwithdraw", beginOffset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      let tx: JsTransaction;
      let recovered: boolean;
      try {
        const r = await client.submitAndWaitForTransaction({
          actAs: [seat.party], commandId,
          commands: [
            ccCmd.createWithdrawProposal({
              owner: seat.party, venue: cfg.venueParty, listingId: cfg.listingId, instrumentAdmin: listingNow.instrumentAdmin, instrumentId: listingNow.instrumentId,
              unitsPerCoin, units: o.units, validUntilSec: Math.floor(now() / 1000) + ASK_STANDS_SEC, ref: o.journalId,
            }),
          ],
          ...inFlightBounds(row),
        });
        tx = r.transaction;
        recovered = r.recovered;
      } catch (error) {
        const d = classifyRejection(error, ctx);
        const state = d.kind === "send-unknown" ? "unknown" : "failed";
        await journal.finish(commandId, { state, diagnosis: d });
        return state === "unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
      }
      await journal.finish(commandId, { state: "landed", updateId: tx.updateId });
      return { kind: "requested", updateId: tx.updateId, recovered };
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d: Diagnosis = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  /**
   * The seat's deposit: a token-standard transfer of `amount` (a `Decimal` string) of the listed instrument from the seat to
   * the venue, instructed as the seat with the registry's factory, choice context and disclosed contracts. It stays a
   * pending `TransferInstruction` until the venue's ops actor accepts it and credits the cash in one transaction. Refused
   * before anything is signed: while not-live, without a registry, for an amount that is not a whole number of cash units
   * (dust is refused, never rounded) or is out of the listing's bounds, or that the seat's unlocked coin does not cover.
   */
  async function requestDeposit(seat: SeatRef, o: { journalId: string; amount: string }): Promise<CcWriteReply> {
    if (cfg.capability !== "live") return { kind: "refused", diagnosis: notLive() };
    const commandId = seatCommandId("ccdeposit", o.journalId);
    const ctx: RejectionContext = { step: "ccdeposit" };
    try {
      const prior = await journal.get(commandId);
      if (prior && (prior.party !== seat.party || prior.leaseId !== seat.leaseId)) throw refuse("contract-revert", "this command id belongs to another seat");
      if (prior && (prior.state === "landed" || prior.state === "unknown")) {
        const updateId = prior.updateId ?? (await client.findAcceptedCompletion(prior.commandId, [seat.party], prior.beginOffset))?.updateId ?? null;
        if (updateId) {
          if (prior.state !== "landed") await journal.finish(commandId, { state: "landed", updateId });
          return { kind: "requested", updateId, recovered: true };
        }
      }
      if (!cfg.registry) throw refuse("not-deployed", "no token registry is configured for this deployment");
      const { listing } = await venueView();
      if (!listing) throw refuse("not-deployed", "the venue has not listed Canton Coin");
      if (!listing.depositsOpen) throw refuse("market-not-trading", "the venue is not taking new Canton Coin deposits");
      let amountAtomic: bigint;
      try {
        amountAtomic = ccToAtomic(o.amount);
        const units = atomicToCashUnitsExact(amountAtomic, listing.unitsPerCoin);
        if (units < listing.minDepositUnits || units > listing.maxDepositUnits) throw refuse("invalid-price", "that amount is outside the listing's deposit limits");
      } catch (error) {
        if (error instanceof UnitsError) throw refuse("invalid-price", error.message.startsWith("dust") ? "that amount is not a whole number of cash units at the listing's rate; it would be sent back, so it is not sent" : "that is not an amount the Canton Coin path converts");
        throw error;
      }
      const accounts = (await client.activeContracts({ parties: [seat.party], templateIds: [TEMPLATE_IDS.VenueAccount], maxPageSize: 100 })).contracts;
      const hasAccount = accounts.some((c) => c.createdEvent.signatories.includes(cfg.venueParty) && c.createdEvent.signatories.includes(seat.party));
      if (!hasAccount) throw refuse("grant-refused", "the seat has no venue account yet: lease the seat first, then deposit");
      const mine = (await readCip56Holdings(client, seat.party)).filter(
        (h) => !h.locked && h.instrumentAdmin === listing.instrumentAdmin && h.instrumentId === listing.instrumentId && h.signatories.includes(listing.instrumentAdmin),
      );
      const cover = coverHoldings(mine.map((h) => ({ cid: h.contractId, templateId: h.templateId, signatories: h.signatories, view: { owner: seat.party, instrumentAdmin: h.instrumentAdmin, instrumentId: h.instrumentId, amountAtomic: h.amountAtomic, lock: null, meta: {} } })), amountAtomic);
      if (!cover) throw refuse("insufficient-collateral", "your unlocked coin does not cover this deposit");
      const nowSec = Math.floor(now() / 1000);
      const args = {
        sender: seat.party, receiver: cfg.venueParty, instrumentAdmin: listing.instrumentAdmin, instrumentId: listing.instrumentId, amountAtomic,
        requestedAtSec: nowSec - 60, executeBeforeSec: nowSec + (cfg.transferWindowSec ?? 86_400), inputHoldingCids: cover.map((h) => h.cid), ref: o.journalId,
      };
      let answer;
      try {
        answer = await cfg.registry.transferFactory(ccCmd.transferChoiceArguments(args));
      } catch (error) {
        if (error instanceof RegistryError) throw refuse("rpc-down", "the token registry did not answer; nothing was sent");
        throw error;
      }
      const beginOffset = await client.ledgerEnd();
      const row = await journal.begin({ commandId, leaseId: seat.leaseId, party: seat.party, kind: "ccdeposit", beginOffset, deadlineMs: now() + DEFAULT_COMMAND_DEADLINE_MS }, now());
      let tx: JsTransaction;
      let recovered: boolean;
      try {
        const r = await client.submitAndWaitForTransaction({
          actAs: [seat.party], commandId,
          commands: [ccCmd.instructDeposit({ ...args, factoryCid: answer.factoryId, context: answer.context })],
          ...(answer.context.disclosedContracts.length > 0 ? { disclosedContracts: answer.context.disclosedContracts } : {}),
          ...inFlightBounds(row),
        });
        tx = r.transaction;
        recovered = r.recovered;
      } catch (error) {
        const d = classifyRejection(error, ctx);
        const state = d.kind === "send-unknown" ? "unknown" : "failed";
        await journal.finish(commandId, { state, diagnosis: d });
        return state === "unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
      }
      await journal.finish(commandId, { state: "landed", updateId: tx.updateId });
      return { kind: "requested", updateId: tx.updateId, recovered };
    } catch (error) {
      if (error instanceof SeatRefusal) return { kind: "refused", diagnosis: error.diagnosis };
      const d: Diagnosis = classifyRejection(error, ctx);
      return d.kind === "send-unknown" ? { kind: "unknown", diagnosis: d } : { kind: "refused", diagnosis: d };
    }
  }

  return { status, requestWithdraw, requestDeposit };
}

export type CcSeat = ReturnType<typeof createCcSeat>;
export type { ContractId };
