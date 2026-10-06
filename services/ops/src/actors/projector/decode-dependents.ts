/**
 * Product dependents in the projector (C8d, C-DAML-03): the abu-pm-tickets contracts that pin a Window's terms. A
 * RangeRound pins its one Window; a ParlayTicket pins every leg it has not yet decided (a decided leg is `won`: it
 * re-creates the ticket, so the old rows close and the open legs' rows reopen on the new contract); a BoostPosition
 * pins its Window until settled, claimed, refunded, knocked out or sold back. Any consuming choice on one of these ends
 * it. Settlement and quote retention count them in the projection, never on the ledger.
 */
import type { IdxFact } from "@agari/db";
import type { CreatedEvent, ExercisedEvent } from "@agari/ledger";

export const TICKETS_PACKAGE_NAME = "abu-pm-tickets";

const DEPENDENT_TEMPLATES = new Set(["PM.Tickets.Range:RangeRound", "PM.Tickets.Parlay:ParlayTicket", "PM.Tickets.Boost:BoostPosition"]);

type Rec = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
/** A Daml variant with no fields reads as its constructor's name on the JSON API (`"Moonshot"`, `"SideDown"`). */
const tag = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" && "tag" in v ? str((v as Rec).tag) : "");

export const isDependentTemplate = (name: string): boolean => DEPENDENT_TEMPLATES.has(name);

export function dependentCreated(name: string, c: CreatedEvent): IdxFact[] {
  const a = (c.createArgument ?? {}) as Rec;
  const owner = str(a.owner);
  switch (name) {
    case "PM.Tickets.Range:RangeRound":
      return [{ kind: "dependent", contractId: c.contractId, product: tag(a.kind) === "Moonshot" ? "moonshot" : "range", owner, terms: [{ termsCid: str(a.termsCid), marketKey: str(a.marketId) }] }];
    case "PM.Tickets.Parlay:ParlayTicket": {
      const legs = (Array.isArray(a.legs) ? a.legs : []) as Rec[];
      const open = legs.filter((l) => l.won !== true).map((l) => ({ termsCid: str(l.termsCid), marketKey: str(l.marketId) }));
      return open.length ? [{ kind: "dependent", contractId: c.contractId, product: "parlay", owner, terms: open }] : [];
    }
    case "PM.Tickets.Boost:BoostPosition":
      return [{ kind: "dependent", contractId: c.contractId, product: tag(a.side) === "SideDown" ? "short" : "boost", owner, terms: [{ termsCid: str(a.termsCid), marketKey: str(a.marketId) }] }];
    default:
      return [];
  }
}

export function dependentExercised(name: string, x: ExercisedEvent): IdxFact[] {
  return isDependentTemplate(name) && x.consuming ? [{ kind: "dependent-closed", contractId: x.contractId, how: x.choice }] : [];
}
