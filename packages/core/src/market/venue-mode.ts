/**
 * The venue's mode (C-DAML-02, the reference's `admin_set_mode`: Normal 0, ReduceOnly 1, Halted 2). On Canton it is
 * issuer policy: ops refuses to open new risk while the venue is not `open`, and a user's way out never asks it
 * (exits, claims, stale refunds and the venue's own settlement stay open in every mode). Pure, so ops' issuer, ticket
 * desk, roller and the web's status row read the same rule.
 */
export const VENUE_MODES = ["open", "reduce-only", "paused"] as const;
export type VenueModeName = (typeof VENUE_MODES)[number];

/** What a caller is about to do. Exits are not here on purpose: nothing a user does to leave ever checks the mode. */
export type VenueModeAction = "open-position" | "supply" | "open-window";

/** The reference's numeric mode (`Venue.mode`), as the web's venue facts carry it. */
export const VENUE_MODE_CODE: Record<VenueModeName, 0 | 1 | 2> = { open: 0, "reduce-only": 1, paused: 2 };

export const isVenueMode = (v: unknown): v is VenueModeName => typeof v === "string" && (VENUE_MODES as readonly string[]).includes(v);

const WHAT: Record<VenueModeAction, string> = {
  "open-position": "no new positions",
  supply: "no new supply to the house",
  "open-window": "no new Windows",
};

/** The roller's lane state while the mode holds new Windows back: `paused: venue reduce-only (reason)`. */
export const venueModePausedState = (mode: VenueModeName, reason: string | null = null): string => `paused: venue ${mode}${reason ? ` (${reason})` : ""}`;

/** The mode and reason out of a lane state `venueModePausedState` wrote, or null for any other state. */
export function venueModeOfState(state: string): { mode: VenueModeName; reason: string | null } | null {
  const m = /^paused: venue (open|reduce-only|paused)(?: \((.+)\))?$/.exec(state);
  return m ? { mode: m[1] as VenueModeName, reason: m[2] ?? null } : null;
}

/**
 * Null when `action` may proceed in `mode`; otherwise the refusal's words. The reference's rule: Halted refuses every
 * new order, ReduceOnly refuses buys only, and opening a Window needs Normal. Reduce-only here means the same: what
 * reduces risk (an exit, a sale back, a withdrawal) goes through; what adds it does not.
 */
export function venueModeRefusal(mode: VenueModeName, action: VenueModeAction, reason: string | null = null): string | null {
  if (mode === "open") return null;
  const why = reason ? ` (${reason})` : "";
  return `the venue is ${mode === "paused" ? "paused" : "reduce-only"} by its operator${why}: ${WHAT[action]}; exits, claims and refunds stay open`;
}
