/**
 * Committee-attested yes/no event markets (C6, an **Addition**: the reference has none; plan "Lanes"). Engine 0.3.0
 * has one resolution path, `Terms_Resolve`, which compares the quorum median of the close print with the open print,
 * so an event rides it unchanged: the committee (the oracle parties, quorum 2) attests a baseline of 1.0 at the
 * event's start and, after it, 2.0 for YES or 0.5 for NO. Close above open resolves Up = YES, below = NO; the
 * `Resolution` is signed by the resolver and the venue as for every Window. The event names itself in its print
 * source (`attested:committee:<id>`). A dedicated event template would read better on the ledger; that is a Daml
 * change for R1, not made here.
 */

export const EVENT_KEY_PREFIX = "EVT-";
export const EVENT_BASELINE_E8 = 100_000_000n;
export const EVENT_YES_E8 = 200_000_000n;
export const EVENT_NO_E8 = 50_000_000n;

export type EventOutcome = "yes" | "no";

export const isEventKey = (key: string): boolean => key.startsWith(EVENT_KEY_PREFIX);

/** The close print a committee member attests for an outcome. */
export const eventCloseE8 = (outcome: EventOutcome): bigint => (outcome === "yes" ? EVENT_YES_E8 : EVENT_NO_E8);

/** The event outcome a resolved Window's side means (Up = YES); null for a void. */
export const eventOutcomeOf = (side: "SideUp" | "SideDown" | null): EventOutcome | null => (side === null ? null : side === "SideUp" ? "yes" : "no");
