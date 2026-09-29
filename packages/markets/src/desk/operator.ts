/**
 * The desk operator's client on Canton (C8f, K-090; mapping in `canton.ts`). The reference's operator signed Jupiter
 * swaps through `agari-desk`; here the operator is the agent-runner party and exercises the owner's `DeskMandate`:
 *
 *   buy         the owner's firm quote on the name's current Window (the venue's issuer, party = owner), marks from
 *               two oracle parties at the Window's fair Up ticks, then `Mandate_Trade`, all disclosed by the venue
 *   sell        the venue's buy-back quote on the owner's largest leg of a held Window, marks, then `Mandate_Sell`
 *   checkpoint  `Mandate_Checkpoint` (allowed paused and in shadow mode)
 *   pause       `Mandate_Pause` (the loss limit's second breach)
 *   reference   `postReference`: the attestors' `DeskMark`s (the reference's `post_reference`)
 *   quote       `quoteSwap`: a preview over the venue's published ladder, in the reference's quote shape (a "token" is
 *               one lot: raw = lots × 10^9)
 *
 * Every seal's command id is deterministic (`deskCommandId`), so a lost answer is found by it and never re-sent under a
 * new one. What belonged to Solana alone (routes, lookup tables, forks, token accounts) refuses with the reason.
 */
import type { Address, Hash32, Signature } from "@agari/core/types";
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import { LedgerError, type ContractId, type DisclosedContract, type Party } from "@agari/ledger/pure";
import type { KeyPairSigner } from "../deploy/client";
import { decodeLeg, templateSuffix, type Side } from "../ops/canton/decode";
import { failureText, isIndefinite, refusalId, submit, type RoleSession } from "../ops/canton/session";
import { acmd } from "../ops/agents";
import { decodeDeskDecision, type DeskMandateC } from "../ops/agents/decode";
import { deskAddressOf } from "../ops/agents/ids";
import { agentLeaseId, type QuoteSource } from "../ops/agents/quotes";
import type { Ladder } from "../runtime/ladder";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import { CONTRACT_RAW_PER_LOT, deskCommandId, deskEventOf, DESK_LOT_RAW, DESK_REF_QUORUM, DEFAULT_CASH_UNIT, hexOfHash, lotsToRaw, rawToLots, sealedOf, seriesOfSymbol, symbolOfMarket } from "./canton";
import { DeskSendError, DeskSendUnknownError } from "./errors";
import { findMandate, mintOf, type Instruction } from "./ops";
import { type DeskEvent, type DeskRpc, type SealedAction } from "./types";

export { DeskSendError, DeskSendUnknownError };

const NO_COUNTERPART = (what: string) => notDeployedError(cantonNotLive(`desk: ${what} has no Canton counterpart`));

export interface DeskOperatorClientConfig {
  /** Reference-only (the Solana operator key); unused on Canton. */
  secretKey?: Uint8Array;
  /** Reference-only (the Solana RPC); unused on Canton. */
  rpcUrl?: string;
  clusterTag: number;
  /** The operator's ledger session: the agent-runner party (K-087). */
  operator: RoleSession;
  /** The venue, read-only here: the quotes, legs and marks the operator's commands disclose. */
  venue: RoleSession;
  /** The oracle parties' sessions; the first `DESK_REF_QUORUM` post the marks a trade needs. */
  attestors: readonly RoleSession[];
  /** The venue's firm quotes for the owner (in process, or ops' signed route). */
  quotes: QuoteSource;
  /** The venue's published ladders (in process, or ops' `/ladders/latest`). */
  ladders: () => Promise<readonly Ladder[]>;
  /** Reads over the ledger (the venue's or the operator's view). */
  rpc: DeskRpc;
}

export interface DeskSendOptions {
  lookupTables?: readonly Address[];
  abortSignal?: AbortSignal;
}

export interface DeskSendResult {
  /** The ledger update id the command landed in. */
  signature: Signature;
  /** The update's offset. */
  slot: bigint;
  computeUnitLimit: number;
  unitsConsumed: number;
  bytes: number;
  events: DeskEvent[];
}

export interface DeskOperatorClient {
  /** The operator party. */
  readonly address: Address;
  /** Reference-only (the Solana key); null on Canton. */
  readonly signer: KeyPairSigner | null;
  readonly clusterTag: number;
  readonly config: DeskOperatorClientConfig;
  simulate(instructions: readonly Instruction[], options?: DeskSendOptions): Promise<{ unitsConsumed: number; bytes: number }>;
  send(step: string, instructions: readonly Instruction[], options?: DeskSendOptions): Promise<DeskSendResult>;
}

export async function createDeskOperatorClient(config: DeskOperatorClientConfig): Promise<DeskOperatorClient> {
  const client: DeskOperatorClient = {
    address: config.operator.party as Address,
    signer: null,
    clusterTag: config.clusterTag,
    config,
    async simulate() {
      return { unitsConsumed: 0, bytes: 0 };
    },
    async send(step, instructions) {
      let last: DeskSendResult | null = null;
      for (const ix of instructions) {
        if (ix.kind !== "pause" || !ix.owner) throw NO_COUNTERPART(`the instruction ${ix.kind}`);
        last = await pauseDesk(client, ix.owner, step);
      }
      if (!last) throw new DeskSendError("simulation", new Error("nothing to send"), null);
      return last;
    },
  };
  return client;
}

export * from "./venue-quote";
import { symbolOfMint, type JupiterQuote, type JupiterRoute, type VenuePreview } from "./venue-quote";

// ---- the reference (the attestors' marks) --------------------------------------------------------------------

export interface PostReferenceAction {
  /** The Window's Daml market id (`<seriesKey>:<index>`). */
  marketId: string;
  side?: Side;
  /** The fair price in the side's ticks (1..999). */
  refTicks: number;
  fetchedAtSec: number;
}

interface PostedMark {
  cid: ContractId;
  disclosure: DisclosedContract | null;
}

const markCommandId = (attestor: Party, marketId: string, ticks: number, sec: number) => `deskmark:${attestor.split("::")[0]}:${marketId}:${ticks}:${sec}`.slice(0, 250);

/** The first `DESK_REF_QUORUM` attestors each post a mark; their stale marks are retired. */
async function postMarks(client: DeskOperatorClient, a: PostReferenceAction): Promise<{ marks: PostedMark[]; last: DeskSendResult | null }> {
  const cfg = client.config;
  const attestors = cfg.attestors.slice(0, DESK_REF_QUORUM);
  if (attestors.length < DESK_REF_QUORUM) throw new DeskSendError("simulation", new Error(`the desk's reference needs ${DESK_REF_QUORUM} oracle parties; this process has ${attestors.length}`), null);
  const marks: PostedMark[] = [];
  let last: DeskSendResult | null = null;
  for (const s of attestors) {
    const out = await submit(s, {
      commandId: markCommandId(s.party, a.marketId, a.refTicks, a.fetchedAtSec),
      commands: [acmd.createDeskMark({ attestor: s.party, venue: cfg.venue.party, marketId: a.marketId, side: a.side ?? "SideUp", refTicks: a.refTicks, fetchedAtSec: a.fetchedAtSec })],
      blobsFor: [AGENT_TEMPLATE_IDS.DeskMark],
    });
    if (out.kind !== "done") throw new DeskSendError("simulation", new Error("a dry session posts no marks"), null);
    const e = out.created.find((c) => templateSuffix(c.templateId) === templateSuffix(AGENT_TEMPLATE_IDS.DeskMark));
    if (!e) throw new DeskSendError("landed", new Error("the mark was not created"), out.transaction.updateId as Signature);
    marks.push({ cid: e.contractId, disclosure: e.createdEventBlob ? { createdEventBlob: e.createdEventBlob, templateId: e.templateId, contractId: e.contractId, synchronizerId: out.transaction.synchronizerId } : null });
    last = { signature: out.transaction.updateId as Signature, slot: BigInt(out.transaction.offset), computeUnitLimit: 0, unitsConsumed: 0, bytes: 0, events: [] };
    void retireStaleMarks(s, a.fetchedAtSec).catch(() => undefined);
  }
  return { marks, last };
}

async function retireStaleMarks(s: RoleSession, nowSec: number): Promise<void> {
  const r = await s.client.activeContracts({ parties: [s.party], templateIds: [AGENT_TEMPLATE_IDS.DeskMark] });
  for (const c of r.contracts) {
    const arg = c.createdEvent.createArgument as { attestor?: string; fetchedAt?: string };
    if (arg.attestor !== s.party || !arg.fetchedAt) continue;
    if (Math.floor(Date.parse(arg.fetchedAt) / 1000) >= nowSec - 900) continue;
    await submit(s, { commandId: `deskmark-retire:${c.createdEvent.contractId}`.slice(0, 250), commands: [acmd.archiveDeskMark(c.createdEvent.contractId)] }).catch(() => undefined);
  }
}

export async function postReference(client: DeskOperatorClient, a: PostReferenceAction): Promise<DeskSendResult> {
  const { last } = await postMarks(client, a);
  if (!last) throw new DeskSendError("simulation", new Error("no mark was posted"), null);
  return last;
}

// ---- the operator's actions ------------------------------------------------------------------------------------

export interface SwapAction {
  /** The owner's party (or their desk address; the mandate is found either way). */
  owner: Address;
  /** The company, by its reference mint. */
  mint: Address;
  /** USDC E6 for a buy (the stake); raw lots (× 10^9) for a sell. */
  amountIn: bigint;
  /** The least out: raw lots for a buy, USDC E6 for a sell. */
  minOut: bigint;
  deadlineSec: number;
  decisionHash: Hash32;
  /** The preview this action was decided on (`quoteSwap`), naming the Window. */
  quote?: JupiterQuote;
  /** Reference-only (the Jupiter route). */
  route?: JupiterRoute;
  priceUpdate?: Address;
  usdcMint?: Address;
  swapProgram?: Address;
  note?: string;
}

export interface SwapResult extends DeskSendResult {
  sealed: SealedAction;
}

export interface CheckpointAction {
  owner: Address;
  deadlineSec: number;
  decisionHash: Hash32;
  note?: string;
}

const disclosureOf = async (venue: RoleSession, templateId: string, cid: ContractId): Promise<DisclosedContract | null> => {
  const r = await venue.client.activeContracts({ parties: [venue.party], templateIds: [templateId], includeCreatedEventBlob: true });
  const hit = r.contracts.find((c) => c.createdEvent.contractId === cid);
  return hit?.createdEvent.createdEventBlob ? { createdEventBlob: hit.createdEvent.createdEventBlob, templateId: hit.createdEvent.templateId, contractId: cid, synchronizerId: hit.synchronizerId } : null;
};

async function mandateFor(client: DeskOperatorClient, owner: Address): Promise<{ cid: string; data: DeskMandateC }> {
  const l = client.config.rpc.ledger;
  if (!l) throw new DeskSendError("simulation", new Error("the operator reads the ledger directly"), null);
  const found = await findMandate(l, owner as string);
  if (!found) throw new DeskSendError("simulation", new Error("the desk's mandate was not found on the ledger"), null);
  if (found.data.operator !== client.address) throw new DeskSendError("simulation", new Error(found.data.operator ? "the desk names a different operator" : "the owner revoked the operator"), null);
  return found;
}

/** One sealing command as the operator, disclosed, under its deterministic id; the seal read back from the result. */
async function seal(client: DeskOperatorClient, m: { cid: string; data: DeskMandateC }, step: string, decisionHash: Hash32, commands: ReturnType<typeof acmd.deskCheckpoint>[], disclosed: DisclosedContract[]): Promise<SwapResult> {
  const address = deskAddressOf(m.data.owner, m.data.venue);
  const commandId = deskCommandId(address, decisionHash, step);
  try {
    const out = await submit(client.config.operator, { commandId, commands, ...(disclosed.length ? { disclosedContracts: disclosed } : {}) });
    if (out.kind !== "done") throw new DeskSendError("simulation", new Error(out.note), null);
    const e = out.created.find((c) => templateSuffix(c.templateId) === templateSuffix(AGENT_TEMPLATE_IDS.DeskDecision));
    if (!e) throw new DeskSendError("landed", new Error("no decision was sealed"), out.transaction.updateId as Signature);
    const d = decodeDeskDecision(e.createArgument);
    return { signature: out.transaction.updateId as Signature, slot: BigInt(out.transaction.offset), computeUnitLimit: 0, unitsConsumed: 0, bytes: 0, events: [deskEventOf(d)], sealed: sealedOf(d) };
  } catch (error) {
    if (error instanceof DeskSendError) throw error;
    if (isIndefinite(error)) throw new DeskSendUnknownError(commandId as Signature, "expired");
    const id = refusalId(error);
    throw new DeskSendError("simulation", new Error(error instanceof LedgerError ? failureText(error) : String(error)), null, id);
  }
}

const previewOf = (a: SwapAction): VenuePreview => {
  const p = a.quote?.raw as VenuePreview | undefined;
  if (!p || !p.damlMarketId) throw new DeskSendError("simulation", new Error("the action carries no venue preview to act on"), null);
  return p;
};

const ticksOfRaw = (priceRaw: bigint): number => Number((priceRaw * 1000n) / CONTRACT_RAW_PER_LOT);

/** Buy: the owner's firm quote on the previewed Window, two marks at its fair price, `Mandate_Trade`. */
export async function buy(client: DeskOperatorClient, a: SwapAction): Promise<SwapResult> {
  const cfg = client.config;
  const m = await mandateFor(client, a.owner);
  const p = previewOf(a);
  const firm = await cfg.quotes.quote({ party: m.data.owner, leaseId: agentLeaseId("desk"), marketId: p.marketId as never, side: "up", stakeBase: a.amountIn, displayedMaxCostBase: a.amountIn });
  if (firm.kind !== "quote") throw new DeskSendError("simulation", new Error(firm.kind === "refused" ? firm.diagnosis.technical : "the venue's price moved past the stake; nothing was bought"), null);
  const lots = firm.quote.contractsRaw / CONTRACT_RAW_PER_LOT;
  if (lotsToRaw(lots) < a.minOut) throw new DeskSendError("simulation", new Error(`the firm quote gives ${lots} lots, under the desk's floor`), null);
  const refTicks = p.fairTicks ?? ticksOfRaw(firm.quote.limitPriceRaw);
  const nowSec = Math.floor(Date.now() / 1000);
  const { marks } = await postMarks(client, { marketId: p.damlMarketId, side: "SideUp", refTicks, fetchedAtSec: nowSec });
  const quoteDisclosure = await disclosureOf(cfg.venue, TEMPLATE_IDS.Quote, firm.quoteCid);
  const disclosed = [quoteDisclosure, ...marks.map((mk) => mk.disclosure)].filter((d): d is DisclosedContract => d !== null);
  const limitTicks = ticksOfRaw(firm.quote.limitPriceRaw);
  return seal(client, m, "trade", a.decisionHash, [
    acmd.deskTrade(m.cid, { actor: client.address as string, quoteCid: firm.quoteCid, limitTicks: Math.max(1, Math.min(999, limitTicks)), asOfSec: nowSec, markCids: marks.map((mk) => mk.cid), prevHead: m.data.head, decisionHash: hexOfHash(a.decisionHash), note: a.note ?? "buy" }),
  ], disclosed);
}

/**
 * Sell: from the held Window with the most lots that the venue still quotes, at most the owner's largest leg there (one
 * buy-back quote, one seal), `Mandate_Sell` with marks at the Window's fair price.
 */
export async function sell(client: DeskOperatorClient, a: SwapAction): Promise<SwapResult> {
  const cfg = client.config;
  const m = await mandateFor(client, a.owner);
  const symbol = symbolOfMint(a.mint);
  if (!symbol) throw new DeskSendError("simulation", new Error("only the eight pre-IPO companies are sold"), null);
  const nowSec = Math.floor(Date.now() / 1000);
  const ladders = await cfg.ladders();
  const quoting = new Map(ladders.filter((l) => l.state === "quoting").map((l) => [l.damlMarketId, l]));
  const held = m.data.holdings.filter((h) => h.side === "SideUp" && h.refundAfterSec > nowSec && symbolOfMarket(h.marketId) === symbol && quoting.has(h.marketId)).sort((x, y) => (x.lots === y.lots ? 0 : x.lots > y.lots ? -1 : 1));
  const holding = held[0];
  if (!holding) throw new DeskSendError("simulation", new Error(`no ${symbol} lots the desk holds are on a Window the venue still quotes`), null);
  const ladder = quoting.get(holding.marketId) as Ladder;
  const legs = (await cfg.venue.client.activeContracts({ parties: [cfg.venue.party], templateIds: [TEMPLATE_IDS.Leg] })).contracts
    .map((c) => ({ cid: c.createdEvent.contractId, leg: decodeLeg(c.createdEvent.createArgument) }))
    .filter((x) => x.leg.owner === m.data.owner && x.leg.marketId === holding.marketId && x.leg.outcome === "SideUp")
    .sort((x, y) => (x.leg.lots === y.leg.lots ? 0 : x.leg.lots > y.leg.lots ? -1 : 1));
  const largest = legs[0]?.leg.lots ?? 0n;
  const wanted = rawToLots(a.amountIn);
  const lots = [wanted, holding.lots, largest].reduce((x, y) => (x < y ? x : y));
  if (lots <= 0n) throw new DeskSendError("simulation", new Error(`the owner holds no ${symbol} leg to sell back`), null);
  const minOut = wanted > 0n ? (a.minOut * lots) / wanted : a.minOut;
  const exit = await cfg.quotes.exitQuote({ party: m.data.owner, leaseId: agentLeaseId("desk"), marketId: ladder.marketId as never, side: "up", contractsRaw: lots * CONTRACT_RAW_PER_LOT, displayedMinProceedsBase: minOut });
  if (exit.kind !== "quote") throw new DeskSendError("simulation", new Error(exit.kind === "refused" ? exit.diagnosis.technical : "the venue's buy-back price fell under the desk's floor; nothing was sold"), null);
  const bqCid = exit.quoteCids[0] as string;
  const bqDisclosure = await disclosureOf(cfg.venue, TEMPLATE_IDS.BuyQuote, bqCid);
  const bqArg = (await cfg.venue.client.activeContracts({ parties: [cfg.venue.party], templateIds: [TEMPLATE_IDS.BuyQuote] })).contracts.find((c) => c.createdEvent.contractId === bqCid)?.createdEvent.createArgument as { legCid?: string } | undefined;
  const legDisclosure = bqArg?.legCid ? await disclosureOf(cfg.venue, TEMPLATE_IDS.Leg, bqArg.legCid) : null;
  const refTicks = ladder.fairTicks ?? ticksOfRaw(exit.exit.limitPriceRaw);
  const { marks } = await postMarks(client, { marketId: holding.marketId, side: "SideUp", refTicks, fetchedAtSec: nowSec });
  const disclosed = [bqDisclosure, legDisclosure, ...marks.map((mk) => mk.disclosure)].filter((d): d is DisclosedContract => d !== null);
  return seal(client, m, "sell", a.decisionHash, [
    acmd.deskSell(m.cid, { actor: client.address as string, buyQuoteCid: bqCid, asOfSec: nowSec, markCids: marks.map((mk) => mk.cid), prevHead: m.data.head, decisionHash: hexOfHash(a.decisionHash), note: a.note ?? "sell" }),
  ], disclosed);
}

/** The daily seal (and any sealed non-action): `Mandate_Checkpoint`. */
export async function checkpoint(client: DeskOperatorClient, a: CheckpointAction): Promise<SwapResult> {
  const m = await mandateFor(client, a.owner);
  return seal(client, m, "checkpoint", a.decisionHash, [
    acmd.deskCheckpoint(m.cid, { actor: client.address as string, prevHead: m.data.head, decisionHash: hexOfHash(a.decisionHash), deadlineSec: a.deadlineSec, note: a.note ?? "checkpoint" }),
  ], []);
}

async function pauseDesk(client: DeskOperatorClient, owner: Address, step: string): Promise<DeskSendResult> {
  const m = await mandateFor(client, owner);
  const commandId = `desk:${deskAddressOf(m.data.owner, m.data.venue)}:${step}:${m.cid.slice(0, 40)}`;
  const out = await submit(client.config.operator, { commandId, commands: [acmd.pauseDesk(m.cid, client.address as string)] });
  if (out.kind !== "done") throw new DeskSendError("simulation", new Error(out.note), null);
  return { signature: out.transaction.updateId as Signature, slot: BigInt(out.transaction.offset), computeUnitLimit: 0, unitsConsumed: 0, bytes: 0, events: [] };
}

// ---- instructions (the reference's builders, carried by `send`) ----------------------------------------------

export interface PostReferenceInput {
  attestor: KeyPairSigner;
  payer: { readonly address: Address };
  mint: Address;
  clusterTag: number;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
  programId?: Address;
}

export async function postReferenceInstructions(_i: PostReferenceInput): Promise<[Instruction, Instruction]> {
  throw NO_COUNTERPART("a signed reference instruction (marks are the attestors' own contracts: `postReference`)");
}
export async function buyIx(..._args: unknown[]): Promise<Instruction> {
  throw NO_COUNTERPART("a raw buy instruction (`buy` exercises Mandate_Trade)");
}
/** The operator's pause, for `client.send("pause", [ix])`. */
export async function pauseIx(_signer: unknown, owner: Address): Promise<Instruction> {
  return { kind: "pause", owner };
}
export async function withdrawAsStrangerIx(_signer: KeyPairSigner, _deskOwner: Address, _mint: Address, _amount: bigint): Promise<Instruction> {
  throw NO_COUNTERPART("a stranger's withdrawal (only the owner controls Mandate_Withdraw; the ledger refuses anyone else)");
}

export * from "./reference-only";

export async function tokenBalance(rpc: DeskRpc, tokenAccount: Address): Promise<bigint | null> {
  const l = rpc.ledger;
  if (!l) return null;
  const found = await findMandate(l, tokenAccount as string);
  return found ? found.data.grant.budget : null;
}

export { DESK_LOT_RAW, DEFAULT_CASH_UNIT, mintOf };
