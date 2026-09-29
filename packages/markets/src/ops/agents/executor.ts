/**
 * The grant executor (C8f): how an agent (the house strategy runner, the X executor, a self-hosted runner) places a
 * call for an owner on Canton. It never holds the owner's cash and never issues a quote:
 *
 *   1. the venue issues the OWNER a firm quote (`QuoteSource`: the issuer in process, or ops over its signed route),
 *   2. the agent reads that quote's disclosure (its created-event blob, read as the venue, or as the owner where the
 *      agent's ledger user may read as the owner),
 *   3. the agent exercises `Grant_AcceptQuote` on the owner's grant, `actAs` itself only, at the quote's own price as
 *      its limit and its clock a second behind ledger time. Every cap is the ledger's to enforce (PM.Grant, the
 *      reference's `caps.ts` order); `simulateCaps` runs first only so a refusal is named before anything is sent.
 *
 * The command id is deterministic over owner · agent · Window · grant · side · the ledger offset the attempt started
 * from (`grantBuyCommandId`), so a lost reply is recovered from the ledger's completion for that id, never re-sent.
 */
import type { OrderOutcome } from "@agari/core/ports";
import { diagnosis, type EventMarket, type MarketId, type Quote, type Side, type Signature } from "@agari/core/types";
import { simulateCaps } from "@agari/core/vault";
import { TEMPLATE_IDS } from "@agari/daml";
import type { DisclosedContract, JsTransaction, LedgerClient, Party, TransactionFormat } from "@agari/ledger";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { classifyRejection } from "../../server/rejection";
import { bookedFrom } from "../../server/writes";
import type { RecoveredVaultExecution, VaultExecutionEvidence } from "../../vault/recovery";
import { decodeLeg, decodeQuote, templateSuffix } from "../canton/decode";
import * as acmd from "./commands";
import { decodeAgentGrant, type AgentGrantC } from "./decode";
import { agentLeaseId, type QuoteSource } from "./quotes";
import { AGENT_DECIMALS, grantIdOfC, grantView } from "./views";

export interface GrantExecutorDeps {
  client: LedgerClient;
  /** The agent's party: what the grants name, and the only `actAs` of every command here. */
  agent: Party;
  /** Parties the executor may read a quote's disclosure as (the venue in ops; the owner for a self-hosted runner). */
  readAs: (owner: Party) => Party[];
  quotes: QuoteSource;
  role: "strategy" | "x" | "desk";
  now?: () => number;
}

export interface PlaceInput {
  owner: Party;
  grant: { cid: string; data: AgentGrantC };
  market: EventMarket;
  side: Side;
  stakeBase: bigint;
  /** The quote the agent decided on; a fresh one above its `maxCostBase` comes back as a requote, never accepted. */
  displayedQuote: Quote;
  /** The ledger end before the attempt (recorded before the send; recovery searches from here). */
  fromOffset: number;
}

/** The deterministic command id of one grant-scoped buy. */
export function grantBuyCommandId(o: { owner: string; actor: string; marketId: string; grantId: bigint; side: Side; fromOffset: bigint | number }): string {
  const digest = bytesToHex(sha256(utf8ToBytes([o.owner, o.actor, o.marketId, o.grantId.toString(), o.side, o.fromOffset.toString()].join("\u0000"))));
  return `grantbuy:${digest.slice(0, 48)}`;
}

const effects = (party: Party): TransactionFormat => ({
  transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
  eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } }, verbose: true },
});

const refused = (kind: Parameters<typeof diagnosis>[0], technical: string): OrderOutcome => ({ status: "refused", diagnosis: diagnosis(kind, technical) });

export function createGrantExecutor(deps: GrantExecutorDeps) {
  const { client, agent } = deps;
  const now = deps.now ?? Date.now;

  /** Every live grant that names this agent (the agent observes them). */
  async function grantsNamingMe(): Promise<{ cid: string; data: AgentGrantC }[]> {
    const r = await client.activeContracts({ parties: [agent], templateIds: [TEMPLATE_IDS.AgentGrant] });
    const out: { cid: string; data: AgentGrantC }[] = [];
    for (const c of r.contracts) {
      try {
        const g = decodeAgentGrant(c.createdEvent.createArgument);
        if (g.agent === agent) out.push({ cid: c.createdEvent.contractId, data: g });
      } catch {
        // not a grant we can act on
      }
    }
    return out;
  }

  /** The quote's disclosure and its ledger terms (price in ticks), read as a party that sees it. */
  async function quoteFacts(quoteCid: string, owner: Party): Promise<{ disclosed: DisclosedContract; priceTicks: number; marketId: string } | null> {
    for (const reader of deps.readAs(owner)) {
      try {
        const r = await client.activeContracts({ parties: [reader], templateIds: [TEMPLATE_IDS.Quote], includeCreatedEventBlob: true });
        const hit = r.contracts.find((c) => c.createdEvent.contractId === quoteCid && templateSuffix(c.createdEvent.templateId) === templateSuffix(TEMPLATE_IDS.Quote));
        if (!hit?.createdEvent.createdEventBlob) continue;
        const q = decodeQuote(hit.createdEvent.createArgument);
        return {
          disclosed: { createdEventBlob: hit.createdEvent.createdEventBlob, templateId: hit.createdEvent.templateId, contractId: quoteCid, synchronizerId: hit.synchronizerId },
          priceTicks: q.priceTicks,
          marketId: q.marketId,
        };
      } catch {
        // try the next reader
      }
    }
    return null;
  }

  /** One grant-scoped buy for `owner`. Every refusal is named; nothing is re-sent. */
  async function place(i: PlaceInput): Promise<OrderOutcome> {
    const nowSec = Math.floor(now() / 1000);
    const g = i.grant.data;
    if (g.owner !== i.owner || g.agent !== agent) return refused("grant-refused", "the grant names another owner or agent");
    // Named before anything is sent: the ledger enforces the same caps in the same order.
    const view = grantView(g, nowSec);
    const one = 10n ** BigInt(AGENT_DECIMALS);
    const sidePriceRaw = i.side === "up" ? i.displayedQuote.limitPriceRaw : one - i.displayedQuote.limitPriceRaw;
    const pre = simulateCaps({ grant: view, nowSec, sidePriceRaw, quantityRaw: i.displayedQuote.contractsRaw, spendBase: i.displayedQuote.maxCostBase, one, opensNewPosition: true });
    if (!pre.ok && pre.refusal.kind !== "positions") return refused("grant-refused", `the grant refuses this call before it is sent: ${pre.refusal.kind}`);

    const reply = await deps.quotes.quote({ marketId: i.market.marketId, side: i.side, stakeBase: i.stakeBase, displayedMaxCostBase: i.displayedQuote.maxCostBase, party: i.owner, leaseId: agentLeaseId(deps.role) });
    if (reply.kind === "refused") return { status: "refused", diagnosis: reply.diagnosis };
    if (reply.kind === "requote") return { status: "requote", quote: reply.quote };
    const facts = await quoteFacts(reply.quoteCid, i.owner);
    if (!facts) return refused("rpc-down", "the owner's firm quote could not be read for disclosure; nothing was sent");

    const commandId = grantBuyCommandId({ owner: i.owner, actor: agent, marketId: i.market.marketId, grantId: grantIdOfC(g), side: i.side, fromOffset: i.fromOffset });
    try {
      const r = await client.submitAndWaitForTransaction({
        actAs: [agent],
        commandId,
        commands: [acmd.acceptQuoteFor(i.grant.cid, reply.quoteCid, facts.priceTicks, nowSec - 1)],
        disclosedContracts: [facts.disclosed],
        transactionFormat: effects(agent),
      });
      return { status: "confirmed", booked: bookedFrom(r.transaction, i.owner) };
    } catch (error) {
      const d = classifyRejection(error, { step: "accept", quoteCid: reply.quoteCid });
      if (d.kind === "send-unknown") return { status: "unknown", diagnosis: d };
      return { status: "refused", diagnosis: d };
    }
  }

  /** A lost reply, answered from the ledger by the attempt's deterministic command id. */
  async function recover(e: VaultExecutionEvidence): Promise<RecoveredVaultExecution> {
    const commandId = grantBuyCommandId({ owner: e.owner, actor: e.actor, marketId: e.marketId, grantId: e.grantId, side: e.side, fromOffset: e.fromSlot });
    let updateId: string | null = e.txHash;
    if (!updateId) updateId = (await client.findAcceptedCompletion(commandId, [agent], Number(e.fromSlot)))?.updateId ?? null;
    if (!updateId) return { status: "unknown" };
    const tx: JsTransaction | undefined = await client.updateById(updateId, effects(agent));
    if (!tx) return { status: "unknown" };
    try {
      const booked = bookedFrom(tx, e.owner);
      const atSec = Math.floor(Date.parse(tx.effectiveAt) / 1000);
      return { status: "confirmed", txHash: updateId as Signature, cashDelta: booked.costBase, tokenDelta: booked.contractsRaw, atSec, side: booked.side };
    } catch {
      return { status: "unknown" };
    }
  }

  return { agent, grantsNamingMe, place, recover };
}

export type GrantExecutor = ReturnType<typeof createGrantExecutor>;

/** The owner's legs on one Window, read as a party that sees them (the venue): "already in this Window". */
export async function ownerHoldsWindow(client: LedgerClient, reader: Party, owner: Party, marketIdOf: (damlMarketId: string) => MarketId, marketId: MarketId): Promise<bigint> {
  const r = await client.activeContracts({ parties: [reader], templateIds: [TEMPLATE_IDS.Leg] });
  let lots = 0n;
  for (const c of r.contracts) {
    try {
      const l = decodeLeg(c.createdEvent.createArgument);
      if (l.owner === owner && marketIdOf(l.marketId) === marketId) lots += l.lots;
    } catch {
      // skip
    }
  }
  return lots;
}
