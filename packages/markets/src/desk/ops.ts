/**
 * The desk's reads and the owner's session on Canton (C8f; mapping in `canton.ts`). A server reads the ledger through
 * `rpc.ledger` (the web tier as the venue, read-only; the desk runner as the venue or its operator); a browser or the
 * phone reads the seat's own desk through the app's routes (`rpc.endpoint`, `/api/ledger/desk/*`). The owner's writes
 * always go through those routes, which submit as the leased seat's party only.
 *
 * What has no Canton counterpart says so when called: the desk "program" is the abu-pm-agents package on the
 * participant, so there is nothing to initialise, and a company is not a mint, so there are no token accounts (every
 * account helper names the desk itself).
 */
import type { PreIpoSymbol } from "@agari/core/market";
import { diagnosis, type Address, type Hash32, type Signature } from "@agari/core/types";
import { AGENT_TEMPLATE_IDS, TEMPLATE_IDS } from "@agari/daml";
import type { ActiveContract, CreatedEvent, LedgerClient, Party } from "@agari/ledger";
import { ReadingError } from "../errors/reading-error";
import { activeOf, decodeVenueCash, templateSuffix } from "../ops/canton/decode";
import { decodeDeskDecision, decodeDeskMandate, decodeDeskMark, type DeskDecisionC, type DeskMandateC, type DeskMarkC } from "../ops/agents/decode";
import { deskAddressOf } from "../ops/agents/ids";
import { ledgerRequest } from "../provider/ledger-api";
import { cantonNotLive, notDeployedError } from "../stub/not-deployed";
import { deskCommandId, deskEventOf, deskStateOf, DESK_LOT_MULTIPLIER_E12, sealedOf, symbolOfSeries } from "./canton";
import { deskClientWrites } from "./session";
import {
  DESK_MINTS,
  type DeskEvent,
  type DeskHistoryEntry,
  type DeskInitPlan,
  type DeskInitRecord,
  type DeskInitWant,
  type DeskLedgerAccess,
  type DeskMainnetSession,
  type DeskMainnetSessionConfig,
  type DeskMintState,
  type DeskRpc,
  type DeskState,
  type DiscoveredDesk,
  type OwnerDeskBalances,
  type SealedAction,
  type SignatureOutcome,
} from "./types";
import { deskStateFromWire, deskStateReplyWire, ownerBalancesFromWire, ownerBalancesWire, sealsFromWire, sealsReplyWire } from "./wire";

const NO_COUNTERPART = (what: string) => notDeployedError(cantonNotLive(`desk: ${what} has no Canton counterpart`));

/** A desk ledger command the operator client carries out (`operator.ts`): the reference's instruction, by kind. */
export type Instruction = { readonly kind: string; readonly owner?: Address };

/** The mint (the reference's key for a company) of each name. */
export const mintOf = (symbol: PreIpoSymbol): Address => DESK_MINTS[symbol];

// ---- construction ----------------------------------------------------------------------------------------

/** A reader over the app's routes (the browser and the phone): the seat's own desk. */
export function createDeskRpc(rpcUrl: string): DeskRpc {
  return { endpoint: rpcUrl };
}
export function createBrowserDeskRpc(url: string): DeskRpc {
  return { endpoint: url };
}
/** A server's reader straight over the ledger. */
export function createDeskLedgerRpc(access: DeskLedgerAccess, endpoint = "ledger"): DeskRpc {
  return { endpoint, ledger: access };
}

const ledgerOf = (rpc: DeskRpc): DeskLedgerAccess => {
  if (!rpc.ledger) throw new ReadingError(diagnosis("not-deployed", "this desk read needs the server's ledger access"));
  return rpc.ledger;
};

// ---- ledger reads ------------------------------------------------------------------------------------------

async function acs(l: DeskLedgerAccess, templateIds: string[], blobs = false): Promise<{ contracts: ActiveContract[]; offset: number }> {
  const r = await l.client.activeContracts({ parties: [...l.readAs], templateIds, includeCreatedEventBlob: blobs });
  return { contracts: r.contracts, offset: Number(r.activeAtOffset ?? 0) };
}

const isTemplate = (e: CreatedEvent, templateId: string) => templateSuffix(e.templateId) === templateSuffix(templateId);

/** Every live mandate visible to the reader (unique by contract id). */
export async function readMandates(l: DeskLedgerAccess): Promise<{ mandates: { cid: string; data: DeskMandateC }[]; marks: DeskMarkC[]; offset: number }> {
  const r = await acs(l, [AGENT_TEMPLATE_IDS.DeskMandate, AGENT_TEMPLATE_IDS.DeskMark]);
  const seen = new Set<string>();
  const mandates: { cid: string; data: DeskMandateC }[] = [];
  const marks: DeskMarkC[] = [];
  for (const c of r.contracts) {
    const e = c.createdEvent;
    if (seen.has(e.contractId)) continue;
    seen.add(e.contractId);
    if (isTemplate(e, AGENT_TEMPLATE_IDS.DeskMandate)) mandates.push(activeOf(e, decodeDeskMandate));
    else if (isTemplate(e, AGENT_TEMPLATE_IDS.DeskMark)) marks.push(decodeDeskMark(e.createArgument));
  }
  return { mandates, marks, offset: r.offset };
}

/** The mandate a key names: an owner party, a desk address, or a seat address the process can resolve. */
export async function findMandate(l: DeskLedgerAccess, key: string): Promise<{ cid: string; data: DeskMandateC; marks: DeskMarkC[]; offset: number } | null> {
  const { mandates, marks, offset } = await readMandates(l);
  let party: string | null = key.includes("::") ? key : null;
  let hit = mandates.find((m) => m.data.owner === party || deskAddressOf(m.data.owner, m.data.venue) === key);
  if (!hit && !party && l.resolveOwner) {
    party = await l.resolveOwner(key);
    if (party) hit = mandates.find((m) => m.data.owner === party);
  }
  return hit ? { ...hit, marks, offset } : null;
}

export async function readDeskState(rpc: DeskRpc, owner: Address, nowSec: number, _usdcMint?: Address): Promise<DeskState | null> {
  if (!rpc.ledger) {
    const r = await ledgerRequest("/desk", { method: "GET", wire: deskStateReplyWire });
    if (!r.ok) throw new ReadingError(r.diagnosis);
    return r.value.state ? deskStateFromWire(r.value.state) : null;
  }
  const found = await findMandate(rpc.ledger, owner as string);
  return found ? deskStateOf({ mandate: found.data, offset: found.offset, nowSec, mintOf, marks: found.marks.filter((m) => m.venue === found.data.venue) }) : null;
}

/** Lots have no mint: every name reads as 9 dp, multiplier 1, never paused (the Window's own state gates trading). */
export async function readDeskMints(_rpc: DeskRpc, mints: readonly Address[], _nowSec: number): Promise<Record<string, DeskMintState>> {
  return Object.fromEntries(mints.map((mint) => [mint as string, { mint, decimals: 9, multiplierE12: DESK_LOT_MULTIPLIER_E12, paused: false }]));
}

/**
 * What the owner could move into the desk: the seat's cash. A name is not a token the owner holds apart from the desk:
 * the desk comes to hold a company only by buying it, so every name reads 0 here.
 */
export async function readOwnerDeskBalances(rpc: DeskRpc, owner: Address, symbols: readonly PreIpoSymbol[], _nowSec: number): Promise<OwnerDeskBalances> {
  if (!rpc.ledger) {
    const r = await ledgerRequest("/desk/balances", { method: "GET", wire: ownerBalancesWire, query: { symbols: symbols.join(",") } });
    if (!r.ok) throw new ReadingError(r.diagnosis);
    return ownerBalancesFromWire(r.value);
  }
  const l = rpc.ledger;
  const party = (owner as string).includes("::") ? (owner as string) : ((await l.resolveOwner?.(owner)) ?? null);
  if (!party) throw new ReadingError(diagnosis("signer-required", "no seat is leased to this address"));
  const r = await l.client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.VenueCash] });
  const cash = r.contracts.map((c) => decodeVenueCash(c.createdEvent.createArgument)).filter((c) => c.owner === party).reduce((s, c) => s + c.amount, 0n);
  return {
    lamports: 0n,
    usdc: { ownerToken: owner, raw: cash },
    names: symbols.map((symbol) => ({ symbol, mint: mintOf(symbol), ownerToken: owner, raw: 0n, multiplierE12: DESK_LOT_MULTIPLIER_E12, paused: false })),
    slot: BigInt(r.activeAtOffset ?? 0),
  };
}

/** The DeskDecisions created in one transaction (an update id), as the reference read its events. */
async function decisionsIn(l: DeskLedgerAccess, updateId: string): Promise<{ decisions: DeskDecisionC[]; offset: number } | null> {
  const tx = await l.client.updateById(updateId, {
    transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
    eventFormat: { filtersByParty: Object.fromEntries(l.readAs.map((p) => [p, { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] }])), verbose: true },
  });
  if (!tx) return null;
  const decisions = tx.events.flatMap((e) => ("CreatedEvent" in e && isTemplate(e.CreatedEvent, AGENT_TEMPLATE_IDS.DeskDecision) ? [decodeDeskDecision(e.CreatedEvent.createArgument)] : []));
  return { decisions, offset: Number(tx.offset) };
}

export async function readSealsOf(rpc: DeskRpc, signature: Signature): Promise<SealedAction[]> {
  if (!rpc.ledger) {
    const r = await ledgerRequest(`/desk/seals/${encodeURIComponent(signature)}`, { method: "GET", wire: sealsReplyWire, seat: false });
    if (!r.ok) throw new ReadingError(r.diagnosis);
    return sealsFromWire(r.value);
  }
  return (await decisionsIn(rpc.ledger, signature))?.decisions.map(sealedOf) ?? [];
}

export async function readDeskEventsOf(rpc: DeskRpc, signature: Signature): Promise<DeskEvent[]> {
  return (await decisionsIn(ledgerOf(rpc), signature))?.decisions.map(deskEventOf) ?? [];
}

/**
 * A desk's sealed decisions, newest first, each with the update it landed in (found by the operator's deterministic
 * command id, `deskCommandId`). A decision whose update cannot be found (sealed by another operator) is left out.
 */
export async function readDeskHistory(rpc: DeskRpc, desk: Address, options: { limit?: number; before?: Signature } = {}): Promise<DeskHistoryEntry[]> {
  const l = ledgerOf(rpc);
  const r = await acs(l, [AGENT_TEMPLATE_IDS.DeskDecision]);
  const rows = r.contracts
    .map((c) => ({ e: c.createdEvent, d: decodeDeskDecision(c.createdEvent.createArgument) }))
    .filter(({ d }) => deskAddressOf(d.owner, d.venue) === (desk as string))
    .sort((a, b) => b.d.seq - a.d.seq);
  const out: DeskHistoryEntry[] = [];
  let skipping = options.before !== undefined;
  for (const { e, d } of rows) {
    if (out.length >= (options.limit ?? 20)) break;
    const parties = [d.operator, ...(l.operator && l.operator !== d.operator ? [l.operator] : [])];
    let completion = null;
    for (const step of ["trade", "sell", "checkpoint"]) {
      completion = await l.client.findAcceptedCompletion(deskCommandId(desk as string, d.decisionHash, step), parties, Math.max(0, Number(e.offset) - 1)).catch(() => undefined);
      if (completion) break;
    }
    if (!completion) continue;
    const signature = completion.updateId as Signature;
    if (skipping) {
      if (signature === options.before) skipping = false;
      continue;
    }
    out.push({ signature, slot: BigInt(e.offset), blockTimeSec: Math.floor(Date.parse(e.createdAt) / 1000), failed: false, events: [deskEventOf(d)] });
  }
  return out;
}

export async function listDesksByOperator(rpc: DeskRpc, operator: Address): Promise<DiscoveredDesk[]> {
  const { mandates } = await readMandates(ledgerOf(rpc));
  return mandates
    .filter((m) => m.data.operator === (operator as string))
    .map(({ data: m }) => ({
      address: deskAddressOf(m.owner, m.venue),
      owner: m.owner as Address,
      operator: m.operator as Address | null,
      mode: m.mode === "DeskShadow" ? "practice" : "on_its_own",
      paused: m.paused,
      seq: BigInt(m.seq),
      head: `0x${m.head}` as Hash32,
    }));
}

/** An update id either landed (it has a transaction) or is not on the ledger; Canton keeps no failed transaction. */
export async function signatureOutcome(rpc: DeskRpc, signature: string): Promise<SignatureOutcome> {
  const l = ledgerOf(rpc);
  const tx = await l.client.updateById(signature, { transactionShape: "TRANSACTION_SHAPE_ACS_DELTA", eventFormat: { filtersByParty: Object.fromEntries(l.readAs.map((p) => [p, { cumulative: [] }])), verbose: false } }).catch(() => undefined);
  return tx ? { kind: "confirmed", slot: BigInt(tx.offset) } : { kind: "none" };
}

/** The operator's clock: ledger time tracks the wall clock on the participant (the Daml deadlines are checked there). */
export async function chainNowSec(_rpc: DeskRpc): Promise<number> {
  return Math.floor(Date.now() / 1000);
}

export async function readDeskInitPlan(_rpc: DeskRpc): Promise<DeskInitPlan> {
  throw NO_COUNTERPART("initialising the desk program (the program is the abu-pm-agents package on the participant)");
}
export async function initDesk(_ctx: unknown, _want: DeskInitWant, _record: DeskInitRecord, _save: () => void): Promise<DeskInitRecord> {
  throw NO_COUNTERPART("initialising the desk program (the program is the abu-pm-agents package on the participant)");
}

const hex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** The sealed decisions (buy, sell, checkpoint) among a transaction's desk events. Pure. */
export function sealedActionsOf(events: readonly DeskEvent[]): SealedAction[] {
  const out: SealedAction[] = [];
  for (const e of events) {
    if (e.name === "Bought" || e.name === "Sold" || e.name === "Checkpoint") out.push({ kind: e.name, seq: e.data.seq, head: hex(e.data.head), decisionHash: hex(e.data.decisionHash) });
  }
  return out;
}

// ---- addresses -------------------------------------------------------------------------------------------------

/** The desk's address-shaped id for an owner party (and the venue, which every desk names). */
export async function deskAddress(owner: Address, venue?: string): Promise<Address> {
  if (!venue) throw NO_COUNTERPART("a desk address without its venue");
  return deskAddressOf(owner as string, venue);
}
/** No token accounts on Canton: the desk itself holds its budget and its holdings. */
export async function associatedTokenAddress(owner: Address, _mint: Address, _tokenProgram: Address): Promise<Address> {
  return owner;
}
export async function deskTokenAccounts(desk: Address, _mint: Address, _usdcMint?: Address): Promise<{ deskUsdc: Address; deskToken: Address }> {
  return { deskUsdc: desk, deskToken: desk };
}
export async function swapAccountsOf(desk: Address, _mint: Address, _usdcMint?: Address): Promise<{ deskUsdc: Address; deskToken: Address }> {
  return { deskUsdc: desk, deskToken: desk };
}

/** The allowList's names (series keys → companies). */
export const namesOfAllowList = (allowList: readonly string[]): PreIpoSymbol[] => allowList.map(symbolOfSeries).filter((s): s is PreIpoSymbol => s !== null);

// ---- the owner's session -------------------------------------------------------------------------------------

/** The owner's desk writes through the app's routes, as the leased seat (the "mainnet session" of the reference). */
export function createDeskMainnetSession(config: DeskMainnetSessionConfig): DeskMainnetSession {
  return deskClientWrites(config.signer.address);
}

export type { LedgerClient, Party };
