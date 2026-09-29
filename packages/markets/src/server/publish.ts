/**
 * Opt-in publication of a call (plan §5: leaderboards, takes and activity come only from `Publication` contracts). The
 * seat exercises `Leg_Publish` on its own leg, `actAs` the seat and nothing else; the `Publication` it creates is signed
 * by the seat and the venue (the leg's signatories), with the ledger's own figures, never the caller's say-so.
 *
 * The handle is the lease's seat address: a seat is recycled between visitors, so a reader asks for the publications
 * of this party under this lease's handle, and a new visitor never sees the last one's calls as their own.
 *
 * Only a live leg can be published today: `Leg_Settle` and `Leg_Claim` archive the leg. A settled call is publishable
 * once the settlement leaves a receipt with its own publish choice (the source `receipt`, refused until it exists).
 */
import { PM, TEMPLATE_IDS } from "@agari/daml";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { MarketId, Side } from "@agari/core/types";
import { fromDamlInt, LedgerError, type Command, type LedgerClient, type Party } from "@agari/ledger";
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
}

export type PublishSource = "leg" | "receipt";

export type PublishResult =
  | { kind: "published"; publications: PublicationView[]; updateId: string | null }
  | { kind: "already"; publications: PublicationView[] }
  | { kind: "refused"; code: "nothing-live" | "receipt-unavailable"; reason: string };

const PUBLICATION = entityOf(TEMPLATE_IDS.Publication);

/** The seat's publications under one handle. Read as the seat: the participant returns only its own. */
export async function readPublications(client: LedgerClient, party: Party, handle: string): Promise<PublicationView[]> {
  const r = await client.activeContracts({ parties: [party], templateIds: [TEMPLATE_IDS.Publication] });
  return r.contracts.flatMap(({ createdEvent: e }) => {
    if (entityOf(e.templateId) !== PUBLICATION) return [];
    const p = PM.Publication.Publication.decoder.runWithException(e.createArgument);
    if (p.owner !== party || p.handle !== handle) return [];
    return [{ cid: e.contractId, marketId: appMarketId(p.marketId), pairId: p.pairId, side: p.outcome === "SideUp" ? "up" : "down", lots: fromDamlInt(p.lots, "Publication.lots"), handle: p.handle }];
  });
}

/** `publish:<digest>`: the same legs under the same lease publish once, however often the button is pressed. */
export function publishCommandId(leaseId: string, legCids: readonly string[]): string {
  return `publish:${bytesToHex(sha256(utf8ToBytes(`${leaseId}|${[...legCids].sort().join(",")}`))).slice(0, 40)}`;
}

export async function publishCall(
  deps: { client: LedgerClient; seats: SeatReader },
  actor: { party: Party; leaseId: string; handle: string },
  o: { marketId: MarketId; source: PublishSource },
): Promise<PublishResult> {
  if (o.source === "receipt") return { kind: "refused", code: "receipt-unavailable", reason: "a settled call leaves no contract to publish from yet" };
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

/** Takes this lease's calls on a Window back off every public read (`Publication_Retract`, the owner's own choice). */
export async function retractCall(deps: { client: LedgerClient }, actor: { party: Party; leaseId: string; handle: string }, o: { marketId: MarketId }): Promise<{ retracted: number }> {
  const mine = (await readPublications(deps.client, actor.party, actor.handle)).filter((p) => p.marketId === o.marketId);
  if (mine.length === 0) return { retracted: 0 };
  const commands: Command[] = mine.map((p) => ({ ExerciseCommand: { templateId: TEMPLATE_IDS.Publication, contractId: p.cid, choice: "Publication_Retract", choiceArgument: {} } }));
  try {
    await deps.client.submitAndWaitForTransaction({ actAs: [actor.party], commandId: `retract:${publishCommandId(actor.leaseId, mine.map((p) => p.cid)).slice("publish:".length)}`, commands });
  } catch (error) {
    if (!(error instanceof LedgerError && error.kind === "duplicate")) throw error;
  }
  return { retracted: mine.length };
}
