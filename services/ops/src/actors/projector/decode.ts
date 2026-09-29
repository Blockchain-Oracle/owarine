/**
 * One `/v2/updates` transaction (LEDGER_EFFECTS, as the venue) → the store's facts. Pure: no ledger or DB access, so
 * every mapping is unit-tested from JSON fixtures.
 *
 * LEDGER_EFFECTS lists every node the venue witnessed, flat, in node order; an exercise's subtree is the nodes in
 * `(nodeId, lastDescendantNodeId]`. Exercised events are what tell the exits apart (the ACS delta cannot): the choice on
 * a consumed `Leg` says settled, claimed, stale refund, merged or closed out; an `Archive` of a user leg inside
 * `BuyQuote_Accept` is a sale (whole or, since 0.3.0, partial). Amounts come from the `VenueCash` the exit created, by bucket.
 *
 * Daml-LF JSON: Int arrives as a decimal string, Time as ISO-8601 (microseconds), an enum as its constructor name, a
 * variant as `{tag, value}`, an Optional as null or the value, a tuple as `{_1, _2, …}`.
 */
import type { IdxEvidence, IdxFact, IdxPolicyVersion, IdxRawEvent, IdxUpdate } from "@agari/db";
import type { CreatedEvent, Event, ExercisedEvent, JsTransaction } from "@agari/ledger";

type Rec = Record<string, unknown>;
type Side = 0 | 1;

export const PM_PACKAGE_NAME = "abu-pm-main";

/** `<pkgId>:PM.Leg:Leg` or `#abu-pm-main:PM.Leg:Leg` → `PM.Leg:Leg`. */
export function templateName(templateId: string): string {
  const parts = templateId.split(":");
  return parts.length >= 3 ? `${parts[parts.length - 2]}:${parts[parts.length - 1]}` : templateId;
}

/** ISO-8601 (any fractional precision) → unix seconds, floored. */
export function isoSec(value: unknown): number {
  const text = String(value);
  const ms = Date.parse(text.replace(/(\.\d{3})\d+/, "$1"));
  if (!Number.isFinite(ms)) throw new Error(`not a ledger time: ${text}`);
  return Math.floor(ms / 1000);
}

/** ISO-8601 → unix milliseconds (sub-millisecond digits dropped). */
export function isoMs(value: unknown): number {
  const text = String(value);
  const ms = Date.parse(text.replace(/(\.\d{3})\d+/, "$1"));
  if (!Number.isFinite(ms)) throw new Error(`not a ledger time: ${text}`);
  return ms;
}

const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  throw new Error(`expected a Daml Int/Text, got ${JSON.stringify(v)}`);
};
const int = (v: unknown): number => {
  const n = Number(str(v));
  if (!Number.isSafeInteger(n)) throw new Error(`Int out of JS range: ${String(v)}`);
  return n;
};
const side = (v: unknown): Side => {
  if (v === "SideUp") return 0;
  if (v === "SideDown") return 1;
  throw new Error(`not a Side: ${JSON.stringify(v)}`);
};
const parties = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : []);

function evidence(v: unknown): IdxEvidence[] {
  return (Array.isArray(v) ? v : []).map((e: Rec) => ({
    oracle: str(e.oracle),
    priceE8: str(e.priceE8),
    fetchedAtSec: isoSec(e.fetchedAt),
    payloadHash: str(e.payloadHash),
    quoteCid: str(e.quoteCid),
  }));
}

function policy(v: Rec): IdxPolicyVersion {
  return {
    version: int(v.version),
    effectiveFromSec: isoSec(v.effectiveFrom),
    validUntilSec: v.validUntil === null || v.validUntil === undefined ? null : isoSec(v.validUntil),
    printSource: str(v.printSource),
    minDelaySec: int(v.minDelaySec),
    barLenSec: int(v.barLenSec),
    openAdmissionSec: int(v.openAdmissionSec),
    closeAdmissionSec: int(v.closeAdmissionSec),
  };
}

/** `MissingPrint {slot = CloseSlot}` → `MissingPrint:CloseSlot`. */
function voidDetail(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const r = v as { tag?: string; value?: { slot?: string } };
  return `${r.tag ?? "Void"}:${r.value?.slot ?? "?"}`;
}

type Node = { nodeId: number; created?: CreatedEvent; exercised?: ExercisedEvent; archived?: { contractId: string; templateId: string; packageName: string } };

function nodeOf(e: Event): Node {
  if ("CreatedEvent" in e) return { nodeId: e.CreatedEvent.nodeId, created: e.CreatedEvent };
  if ("ExercisedEvent" in e) return { nodeId: e.ExercisedEvent.nodeId, exercised: e.ExercisedEvent };
  return { nodeId: e.ArchivedEvent.nodeId, archived: e.ArchivedEvent };
}

const isPm = (packageName: string | undefined) => packageName === undefined || packageName === PM_PACKAGE_NAME;

export interface DecodeOptions {
  /** Legs seen without their creating exercise (the ACS bootstrap) have origin `snapshot`. */
  snapshot?: boolean;
}

export function decodeTransaction(tx: JsTransaction, o: DecodeOptions = {}): IdxUpdate {
  const nodes = tx.events.map(nodeOf).sort((a, b) => a.nodeId - b.nodeId);
  // Parent of each node: the nearest enclosing exercise.
  const parent = new Map<number, ExercisedEvent>();
  const stack: ExercisedEvent[] = [];
  for (const n of nodes) {
    while (stack.length > 0 && stack[stack.length - 1]!.lastDescendantNodeId < n.nodeId) stack.pop();
    if (stack.length > 0) parent.set(n.nodeId, stack[stack.length - 1]!);
    if (n.exercised) stack.push(n.exercised);
  }
  const within = (ex: ExercisedEvent) => nodes.filter((n) => n.nodeId > ex.nodeId && n.nodeId <= ex.lastDescendantNodeId);
  /** Venue cash an exercise's subtree created, summed per bucket. */
  const cashBy = (ex: ExercisedEvent): Map<string, bigint> => {
    const out = new Map<string, bigint>();
    for (const n of within(ex)) {
      if (!n.created || templateName(n.created.templateId) !== "PM.Money:VenueCash") continue;
      const a = n.created.createArgument as Rec;
      out.set(str(a.bucket), (out.get(str(a.bucket)) ?? 0n) + BigInt(str(a.amount)));
    }
    return out;
  };
  const sum = (m: Map<string, bigint>, buckets: string[]) => buckets.reduce((acc, b) => acc + (m.get(b) ?? 0n), 0n).toString();

  const events: IdxRawEvent[] = [];
  const facts: IdxFact[] = [];

  for (const n of nodes) {
    if (n.created) {
      const c = n.created;
      const name = templateName(c.templateId);
      const a = (c.createArgument ?? {}) as Rec;
      events.push({
        nodeId: n.nodeId, kind: "created", template: name, packageName: c.packageName ?? null, contractId: c.contractId, choice: null,
        consuming: null, lastDescendant: null, marketKey: typeof a.marketId === "string" ? a.marketId : null, data: c.createArgument ?? null,
      });
      if (isPm(c.packageName)) facts.push(...createdFacts(name, c, a, parent.get(n.nodeId), o, cashBy, tx.synchronizerId || null));
    } else if (n.exercised) {
      const x = n.exercised;
      const name = templateName(x.templateId);
      events.push({
        nodeId: n.nodeId, kind: "exercised", template: name, packageName: x.packageName ?? null, contractId: x.contractId, choice: x.choice,
        consuming: x.consuming, lastDescendant: x.lastDescendantNodeId, marketKey: null,
        data: { choiceArgument: x.choiceArgument ?? null, exerciseResult: x.exerciseResult ?? null, actingParties: x.actingParties },
      });
      if (isPm(x.packageName)) facts.push(...exercisedFacts(name, x, parent.get(n.nodeId), within, cashBy, sum));
    } else if (n.archived) {
      events.push({
        nodeId: n.nodeId, kind: "archived", template: templateName(n.archived.templateId), packageName: n.archived.packageName ?? null,
        contractId: n.archived.contractId, choice: null, consuming: true, lastDescendant: null, marketKey: null, data: null,
      });
    }
  }

  return {
    updateId: tx.updateId,
    offset: tx.offset,
    recordTimeMs: tx.recordTime ? Date.parse(tx.recordTime.replace(/(\.\d{3})\d+/, "$1")) : null,
    effectiveAtMs: isoSec(tx.effectiveAt) * 1000,
    commandId: tx.commandId ?? null,
    workflowId: tx.workflowId || null,
    events,
    facts,
  };
}

function createdFacts(
  name: string,
  c: CreatedEvent,
  a: Rec,
  up: ExercisedEvent | undefined,
  o: DecodeOptions,
  cashBy: (ex: ExercisedEvent) => Map<string, bigint>,
  synchronizerId: string | null,
): IdxFact[] {
  const cid = c.contractId;
  switch (name) {
    case "PM.Series:Series":
      return [{
        kind: "series", contractId: cid, seriesKey: str(a.seriesKey), symbol: str(a.symbol), cadenceSec: int(a.cadenceSec), cashUnit: str(a.cashUnit),
        nextIndex: int(a.nextIndex), anchorSec: isoSec(a.anchor), lockLeadSec: int(a.lockLeadSec), settleGraceSec: int(a.settleGraceSec),
        quorum: int(a.quorum), oracles: parties(a.oracles), maxDeviationBps: int(a.maxDeviationBps), resolver: str(a.resolver),
        policyVersions: (Array.isArray(a.policyVersions) ? a.policyVersions : []).map((p: Rec) => policy(p)),
      }];
    case "PM.Market:MarketTerms":
      return [{
        kind: "window-opened", termsCid: cid, marketKey: str(a.marketId), seriesKey: str(a.seriesKey), index: int(a.index), symbol: str(a.symbol),
        cashUnit: str(a.cashUnit), tradingStartSec: isoSec(a.tradingStart), lockAtSec: isoSec(a.lockAt), expirySec: isoSec(a.expiry),
        openDeadlineSec: isoSec(a.openDeadline), closeDeadlineSec: isoSec(a.closeDeadline), refundAfterSec: isoSec(a.refundAfter),
        policyVersion: int(a.policyVersion), printSource: str(a.printSource), minDelaySec: int(a.minDelaySec), barLenSec: int(a.barLenSec),
        tieUp: a.tieUp === true, quorum: int(a.quorum), oracles: parties(a.oracles), maxDeviationBps: int(a.maxDeviationBps), resolver: str(a.resolver),
      }];
    case "PM.Market:WindowState":
      return [{ kind: "window-state", contractId: cid, termsCid: str(a.termsCid), live: true }];
    case "PM.Market:OpenPrint":
      return [{ kind: "open-print", contractId: cid, termsCid: str(a.termsCid), openPriceE8: str(a.openPriceE8), signers: int(a.signers), evidence: evidence(a.evidence) }];
    case "PM.Market:Resolution":
      return [{
        kind: "resolution", contractId: cid, termsCid: str(a.termsCid), outcome: a.outcome === null || a.outcome === undefined ? null : side(a.outcome),
        voidDetail: voidDetail(a.voidReason), openPriceE8: a.openPriceE8 === null || a.openPriceE8 === undefined ? null : str(a.openPriceE8),
        closePriceE8: a.closePriceE8 === null || a.closePriceE8 === undefined ? null : str(a.closePriceE8),
        openEvidence: evidence(a.openEvidence), closeEvidence: evidence(a.closeEvidence), signers: int(a.signers),
        createdAtMs: c.createdAt ? isoMs(c.createdAt) : 0, templateId: c.templateId, createdEventBlob: c.createdEventBlob || null, synchronizerId,
      }];
    case "PM.Oracle:PriceQuote":
      return [{
        kind: "price", contractId: cid, oracle: str(a.oracle), symbol: str(a.symbol), boundarySec: isoSec(a.boundaryT), priceE8: str(a.priceE8),
        barStartSec: isoSec(a.barStart), barLenSec: int(a.barLenSec), fetchedAtSec: isoSec(a.fetchedAt), payloadHash: str(a.payloadHash),
        policyVersion: int(a.policyVersion),
      }];
    case "PM.Quote:Quote":
      return [{
        kind: "quote", quoteKind: "quote", contractId: cid, user: str(a.user), termsCid: str(a.termsCid), marketKey: str(a.marketId), pairId: str(a.pairId),
        side: side(a.side), priceTicks: int(a.priceTicks), lots: str(a.lots), cashUnit: str(a.cashUnit), fee: str(a.fee), legCid: null,
        validUntilSec: isoSec(a.validUntil),
      }];
    case "PM.Quote:BuyQuote":
      return [{
        kind: "quote", quoteKind: "buy", contractId: cid, user: str(a.user), termsCid: str(a.termsCid), marketKey: null, pairId: str(a.pairId),
        side: side(a.outcome), priceTicks: int(a.priceTicks), lots: str(a.lots), cashUnit: str(a.cashUnit), fee: "0", legCid: str(a.legCid),
        validUntilSec: isoSec(a.validUntil),
      }];
    case "PM.Leg:Leg": {
      const origin = o.snapshot
        ? "snapshot"
        : up?.choice === "Quote_Accept" ? "accept" : up?.choice === "BuyQuote_Accept" ? "buyback" : up?.choice === "Leg_CloseOut" ? "closeout" : "other";
      return [{
        kind: "leg", nodeId: c.nodeId, contractId: cid, owner: str(a.owner), venue: str(a.venue), termsCid: str(a.termsCid), marketKey: str(a.marketId),
        pairId: str(a.pairId), outcome: side(a.outcome), lots: str(a.lots), cashUnit: str(a.cashUnit), backingShare: str(a.backingShare),
        feePaid: str(a.feePaid), refundAfterSec: isoSec(a.refundAfter), origin,
        acceptNodeId: origin === "accept" ? up!.nodeId : null, quoteCid: origin === "accept" ? up!.contractId : null,
      }];
    }
    case "PM.Publication:Publication":
      return [{
        kind: "publication", contractId: cid, owner: str(a.owner), handle: str(a.handle), marketKey: str(a.marketId), pairId: str(a.pairId),
        outcome: side(a.outcome), lots: str(a.lots), backingShare: str(a.backingShare),
      }];
    default:
      void cashBy;
      return [];
  }
}

const QUOTE_CLOSE: Record<string, "accepted" | "expired" | "withdrawn"> = {
  Quote_Accept: "accepted", BuyQuote_Accept: "accepted", Quote_Expire: "expired", BuyQuote_Expire: "expired",
  Quote_Withdraw: "withdrawn", BuyQuote_Withdraw: "withdrawn", Archive: "withdrawn",
};

const LEG_EXIT: Record<string, "settled" | "claimed" | "refunded_stale" | "closed_out" | "merged"> = {
  Leg_Settle: "settled", Leg_Claim: "claimed", Leg_RefundStale: "refunded_stale", Leg_CloseOut: "closed_out", Leg_Merge: "merged",
};

/** Buckets `PM.*` pays an exit into: owner payout, stale refund, close-out, sale, netting release; and the venue's fee. */
const PAID = ["payout", "refund", "close-out", "sale", "netting"];
const FEE = ["fee"];

function exercisedFacts(
  name: string,
  x: ExercisedEvent,
  up: ExercisedEvent | undefined,
  within: (ex: ExercisedEvent) => Node[],
  cashBy: (ex: ExercisedEvent) => Map<string, bigint>,
  sum: (m: Map<string, bigint>, buckets: string[]) => string,
): IdxFact[] {
  const cid = x.contractId;
  switch (name) {
    case "PM.Market:WindowState":
      return x.consuming ? [{ kind: "window-state", contractId: cid, termsCid: "", live: false }] : [];
    case "PM.Market:OpenPrint":
      return x.consuming ? [{ kind: "open-print-consumed", contractId: cid }] : [];
    case "PM.Oracle:PriceQuote":
      return x.consuming ? [{ kind: "price-retired", contractId: cid }] : [];
    case "PM.Publication:Publication":
      return x.consuming ? [{ kind: "publication-archived", contractId: cid }] : [];
    case "PM.Quote:Quote":
    case "PM.Quote:BuyQuote": {
      if (!x.consuming) return [];
      const out: IdxFact[] = [{ kind: "quote-closed", contractId: cid, how: QUOTE_CLOSE[x.choice] ?? "withdrawn" }];
      if (x.choice === "BuyQuote_Accept") {
        const sub = within(x);
        const sold = sub.find((n) => n.exercised && templateName(n.exercised.templateId) === "PM.Leg:Leg" && n.exercised.consuming);
        // The venue's slice (owner = venue); a partial sale (0.3.0) also re-creates the user's remainder leg.
        const venueLeg = sub.find((n) => {
          if (!n.created || templateName(n.created.templateId) !== "PM.Leg:Leg") return false;
          const a = n.created.createArgument as Rec;
          return str(a.owner) === str(a.venue);
        });
        const saleBase = sum(cashBy(x), ["sale"]);
        if (sold?.exercised && venueLeg?.created) {
          const l = venueLeg.created.createArgument as Rec;
          const unit = BigInt(str(l.lots)) * BigInt(str(l.cashUnit));
          out.push({ kind: "sale", nodeId: x.nodeId, buyQuoteCid: cid, legCid: sold.exercised.contractId, priceTicks: Number(BigInt(saleBase) / unit), saleBase, lots: str(l.lots) });
        }
      }
      return out;
    }
    case "PM.Leg:Leg": {
      if (!x.consuming) return [];
      const arg = (x.choiceArgument ?? {}) as Rec;
      const resolutionCid = typeof arg.resolutionCid === "string" ? arg.resolutionCid : null;
      const direct = LEG_EXIT[x.choice];
      if (direct) {
        const cash = cashBy(x);
        return [{ kind: "leg-closed", contractId: cid, how: direct, paidBase: sum(cash, PAID), feeBase: sum(cash, FEE), resolutionCid }];
      }
      // A plain archive: inside BuyQuote_Accept it is the sale of the user's leg; inside Leg_Merge, the other venue leg.
      if (up?.choice === "BuyQuote_Accept") {
        const cash = cashBy(up);
        return [{ kind: "leg-closed", contractId: cid, how: "sold", paidBase: sum(cash, ["sale"]), feeBase: sum(cash, FEE), resolutionCid: null }];
      }
      const how = up?.choice === "Leg_Merge" ? "merged" : "archived";
      return [{ kind: "leg-closed", contractId: cid, how, paidBase: "0", feeBase: "0", resolutionCid: null }];
    }
    default:
      return [];
  }
}
