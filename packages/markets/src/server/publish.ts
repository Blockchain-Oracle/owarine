/**
 * Opt-in publication of a call (plan §5: leaderboards, takes and activity come only from `Publication` contracts). The
 * seat exercises `Leg_Publish` on its own leg, `actAs` the seat and nothing else; the `Publication` it creates is signed
 * by the seat and the venue (the leg's signatories), with the ledger's own figures, never the caller's say-so.
 *
 * The handle is the lease's seat address: a seat is recycled between visitors, so a reader asks for the publications
 * of this party under this lease's handle, and a new visitor never sees the last one's calls as their own.
 *
 * A live leg publishes through `Leg_Publish` (source `leg`). A settled call publishes from the `SettlementReceipt` the
 * settlement left (engine 0.4.0, K-028): source `receipt` exercises `Receipt_Publish` on the seat's receipts on that
 * Window, only those created under this lease (from its start offset), so a new visitor never publishes the last one's.
 * A pair leg's receipts publish together (each pair once); a ticket's receipt is named by `receiptId`, and its
 * `Publication` carries the ticket's `product`.
 */
import { PM, TEMPLATE_IDS } from "@owarine/daml";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { MarketId, Side } from "@owarine/core/types";
import { fromDamlInt, LedgerError, type Command, type LedgerClient, type Party } from "@owarine/ledger";
import { entityOf } from "./contracts";
import { appMarketId } from "./ids";
import type { SeatReader } from "./reads";

export interface PublicationView {
  cid: string;
  marketId: MarketId;
  pairId: string;
  side: Side;
  lots: bigint;
  handle: string;
  /** 0.4.0: null for a pair leg; the ticket product otherwise. */
  product: string | null;
}

export type PublishSource = "leg" | "receipt";

export type PublishResult =
  | { kind: "published"; publications: PublicationView[]; updateId: string | null }
  | { kind: "already"; publications: PublicationView[] }
  | { kind: "refused"; code: "nothing-live" | "receipt-unavailable"; reason: string };

const PUBLICATION = entityOf(TEMPLATE_IDS.Publication);
const RECEIPT = entityOf(TEMPLATE_IDS.SettlementReceipt);

/** The seat's publications under one handle. Read as the seat: the participant returns only its own. */
export async function readPublications(client: LedgerClient, party: Party, handle: string): Promise<PublicationView[]> {
  const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.Publication] });
  return r.contracts.flatMap(({ createdEvent: e }) => {
    if (entityOf(e.templateId) !== PUBLICATION) return [];
    const p = PM.Publication.Publication.decoder.runWithException(e.createArgument);
    if (p.owner !== party || p.handle !== handle) return [];
    return [{
      cid: e.contractId, marketId: appMarketId(p.marketId), pairId: p.pairId, side: p.outcome === "SideUp" ? "up" : "down", lots: fromDamlInt(p.lots, "Publication.lots"),
      handle: p.handle, product: p.product ?? null,
    }];
  });
}

export interface ReceiptView {
  cid: string;
  marketId: MarketId;
  pairId: string;
  product: string | null;
  /** The offset the receipt was created at: the lease filter. */
  offset: number;
}

/** The seat's settlement receipts from `fromOffset` on (this lease's), read as the seat. */
export async function readReceipts(client: LedgerClient, party: Party, fromOffset: number): Promise<ReceiptView[]> {
  const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.SettlementReceipt] });
  return r.contracts.flatMap(({ createdEvent: e }) => {
    if (entityOf(e.templateId) !== RECEIPT || (e.offset ?? 0) < fromOffset) return [];
    const x = PM.Publication.SettlementReceipt.decoder.runWithException(e.createArgument);
    if (x.owner !== party) return [];
    return [{ cid: e.contractId, marketId: appMarketId(x.marketId), pairId: x.pairId, product: x.product ?? null, offset: e.offset ?? 0 }];
  });
}

/** `Receipt_Publish` on the receipts not yet published under this handle (pair legs by pair; a ticket by its receipt id). */
async function publishReceipts(
  deps: { client: LedgerClient; seats: SeatReader },
  actor: { party: Party; leaseId: string; handle: string; fromOffset?: number },
  o: { marketId: MarketId; receiptId?: string; privatePairs?: ReadonlySet<string> },
): Promise<PublishResult> {
  const [receipts, existing] = await Promise.all([readReceipts(deps.client, actor.party, actor.fromOffset ?? 0), readPublications(deps.client, actor.party, actor.handle)]);
  // C8d (L-39): a private call's receipt is never published, whoever asks.
  const onWindow = receipts.filter((r) => r.marketId === o.marketId && (o.receiptId ? r.cid === o.receiptId : r.product === null) && !o.privatePairs?.has(r.pairId));
  const mine = existing.filter((p) => p.marketId === o.marketId && (o.receiptId ? p.product === onWindow[0]?.product : p.product === null));
  const done = new Set(mine.map((p) => `${p.product ?? ""}|${p.pairId}`));
  const todo = onWindow.filter((r) => !done.has(`${r.product ?? ""}|${r.pairId}`));
  if (todo.length === 0) {
    if (mine.length > 0) return { kind: "already", publications: mine };
    return { kind: "refused", code: "receipt-unavailable", reason: "the seat has no settlement receipt on this Window under this lease" };
  }
  const commands: Command[] = todo.map((r) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.SettlementReceipt, contractId: r.cid, choice: "Receipt_Publish", choiceArgument: { handle: actor.handle } } }));
  let updateId: string | null = null;
  try {
    const out = await deps.client.submitAndWaitForTransaction({ actAs: [actor.party], commandId: publishCommandId(actor.leaseId, todo.map((r) => r.cid)), commands });
    updateId = out.transaction.updateId;
  } catch (error) {
    if (!(error instanceof LedgerError && error.kind === "duplicate")) throw error;
  }
  const after = (await readPublications(deps.client, actor.party, actor.handle)).filter((p) => p.marketId === o.marketId);
  return { kind: "published", publications: after, updateId };
}

/** `publish:<digest>`: the same legs under the same lease publish once, however often the button is pressed. */
export function publishCommandId(leaseId: string, legCids: readonly string[]): string {
  return `publish:${bytesToHex(sha256(utf8ToBytes(`${leaseId}|${[...legCids].sort().join(",")}`))).slice(0, 40)}`;
}

export async function publishCall(
  deps: { client: LedgerClient; seats: SeatReader },
  actor: { party: Party; leaseId: string; handle: string; fromOffset?: number },
  o: { marketId: MarketId; source: PublishSource; receiptId?: string; privatePairs?: ReadonlySet<string> },
): Promise<PublishResult> {
  if (o.source === "receipt") return publishReceipts(deps, actor, o);
  const [snap, existing] = await Promise.all([deps.seats.read(actor.party, { fresh: true }), readPublications(deps.client, actor.party, actor.handle)]);
  const mine = existing.filter((p) => p.marketId === o.marketId);
  const done = new Set(mine.map((p) => p.pairId));
  const legs = snap.legs.filter((l) => l.marketId === o.marketId && !done.has(l.pairId));
  if (legs.length === 0) {
    if (mine.length > 0) return { kind: "already", publications: mine };
    return { kind: "refused", code: "nothing-live", reason: "the seat holds no live leg on this Window" };
  }
  const commands: Command[] = legs.map((l) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.Leg, contractId: l.cid, choice: "Leg_Publish", choiceArgument: { handle: actor.handle } } }));
  let updateId: string | null = null;
  try {
    const r = await deps.client.submitAndWaitForTransaction({ actAs: [actor.party], commandId: publishCommandId(actor.leaseId, legs.map((l) => l.cid)), commands });
    updateId = r.transaction.updateId;
  } catch (error) {
    // A retry of a publish that already landed: its publications are on the ledger, read them back below.
    if (!(error instanceof LedgerError && error.kind === "duplicate")) throw error;
  } finally {
    deps.seats.invalidate(actor.party);
  }
  const after = (await readPublications(deps.client, actor.party, actor.handle)).filter((p) => p.marketId === o.marketId);
  return { kind: "published", publications: after, updateId };
}

/**
 * Takes this lease's calls on a Window back off every public read (`Publication_Retract`, the owner's own choice), for one
 * product only (C6e, K-070): `product` null (the default) retracts the pair-leg publications, a ticket product retracts
 * that product's. A pair leg and a ticket on the same Window are separate calls, so retracting one never takes the other.
 */
export async function retractCall(
  deps: { client: LedgerClient },
  actor: { party: Party; leaseId: string; handle: string },
  o: { marketId: MarketId; product?: string | null },
): Promise<{ retracted: number }> {
  const product = o.product ?? null;
  const mine = (await readPublications(deps.client, actor.party, actor.handle)).filter((p) => p.marketId === o.marketId && p.product === product);
  if (mine.length === 0) return { retracted: 0 };
  const commands: Command[] = mine.map((p) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.Publication, contractId: p.cid, choice: "Publication_Retract", choiceArgument: {} } }));
  try {
    await deps.client.submitAndWaitForTransaction({ actAs: [actor.party], commandId: `retract:${publishCommandId(actor.leaseId, mine.map((p) => p.cid)).slice("publish:".length)}`, commands });
  } catch (error) {
    if (!(error instanceof LedgerError && error.kind === "duplicate")) throw error;
  }
  return { retracted: mine.length };
}
