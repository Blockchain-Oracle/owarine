/**
 * Committee-attested yes/no event markets (C6, an **Addition**: the reference has none; plan "Lanes", parity C-ADD-06).
 *
 * Engine 0.4.0 (K-030) makes an event first-class: `Series_OpenEvent` lists the event as its Series' next Window (the
 * ordinary `MarketTerms`, so quotes, legs, grants and tickets work unchanged) beside an `EventTerms` carrying the
 * question and the committee (the Series' oracle parties and quorum). After the close each member posts an
 * `EventAttestation` (YES or NO, signed by that member alone), and the resolver runs `Event_Resolve`: a unanimous
 * counted quorum resolves Up = YES or Down = NO; a YES/NO mix voids as `SourceDisagreement` (the committee's deviation
 * limit is zero). After the deadline `Event_Void` names the reason as a price void does. The `EventVerdict` beside the
 * `Resolution` records the question and every attestation counted.
 *
 * The attestation's `statementHash` follows the reference's attested-print rule (`agari-common/print/attested.rs`: a
 * signed message binds a domain tag, the market, the value, the named source and the times): the member's statement
 * binds `agari-event-v1`, the market, the question, the answer, the source the member read and the time, and its
 * sha-256 is what the ledger keeps. The statement itself is kept off-ledger (the member's log, the evidence note), so
 * anyone holding it can check the hash on the verdict.
 *
 * This replaces the 0.3.0 encoding (a 1.0 baseline, then 2.0 for YES or 0.5 for NO, through `Terms_Resolve`).
 */

export const EVENT_KEY_PREFIX = "EVT-";
/** Domain tag of an event statement, like the reference's `agari-print-v1`. */
export const EVENT_STATEMENT_DOMAIN = "agari-event-v1";

export type EventOutcome = "yes" | "no";

export const isEventKey = (key: string): boolean => key.startsWith(EVENT_KEY_PREFIX);

/** The event outcome a resolved Window's side means (Up = YES); null for a void. */
export const eventOutcomeOf = (side: "SideUp" | "SideDown" | null): EventOutcome | null => (side === null ? null : side === "SideUp" ? "yes" : "no");

/** One committee member's statement: what the attestation's `statementHash` commits to. */
export interface EventStatement {
  /** The Daml market id (`EVT-DEMO-1:0`). */
  marketId: string;
  question: string;
  answer: EventOutcome;
  /** Where the member read the answer: a URL, a document, a feed. Required: a statement without a source is refused. */
  source: string;
  /** The member's role or name, as its log shows it. */
  member: string;
  attestedAtSec: number;
}

/** The canonical statement text: fixed key order, one JSON line, so the same statement always hashes the same. */
export function eventStatementText(s: EventStatement): string {
  if (!s.question.trim()) throw new Error("an event statement names the question");
  if (!s.source.trim()) throw new Error("an event statement names the source the member read");
  if (s.answer !== "yes" && s.answer !== "no") throw new Error(`answer must be yes or no, got ${String(s.answer)}`);
  if (!Number.isSafeInteger(s.attestedAtSec) || s.attestedAtSec <= 0) throw new Error("attestedAtSec must be a positive unix second");
  return JSON.stringify({
    domain: EVENT_STATEMENT_DOMAIN, marketId: s.marketId, question: s.question, answer: s.answer, source: s.source, member: s.member, attestedAtSec: s.attestedAtSec,
  });
}

/**
 * How the venue prices an event it has no model of (C6d, K-067): even odds, quoted wide, from the open until lock.
 * `EVENT_FAIR_TICKS ± EVENT_HALF_SPREAD_TICKS` is 350 / 650, the same stance as the Gap lane's blind quote
 * (`GAP_BLIND_FAIR_TICKS ± GAP_BLIND_HALF_SPREAD_TICKS`): the venue knows nothing past the question, so it rests wide.
 */
export const EVENT_FAIR_TICKS = 500;
export const EVENT_HALF_SPREAD_TICKS = 150;
