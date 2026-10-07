/**
 * The venue mode in ops (C-DAML-02): one process-wide state that the issuer, the resting desk, the ticket desk, the
 * arena and the roller ask before they open new risk, and that `/session` serves. It starts from the latest row of the
 * audit log (`venue_mode_log`, Postgres) or, with no database, from `VENUE_MODE` (default `open`), and changes only
 * through the admin route `/internal/admin/venue-mode` (`OPS_ADMIN_SECRET`). Nothing a user does to leave a position
 * ever reads it: exits, claims, stale refunds and the venue's own settlement are not callers.
 */
import { isVenueMode, venueModeRefusal, type VenueModeAction, type VenueModeName } from "@owarine/core/market";
import { ensureSchema, getDb, latestVenueMode, recordVenueMode } from "@owarine/db";

export interface VenueModeState {
  mode: VenueModeName;
  reason: string | null;
  setBy: string;
  setAtSec: number;
  /** Where the state came from: the audit log, the environment, or the default. */
  source: "log" | "env" | "default";
}

const nowSec = () => Math.floor(Date.now() / 1000);

function fromEnv(): VenueModeState {
  const raw = process.env.VENUE_MODE?.trim();
  return isVenueMode(raw) ? { mode: raw, reason: "VENUE_MODE at boot", setBy: "env", setAtSec: nowSec(), source: "env" } : { mode: "open", reason: null, setBy: "default", setAtSec: nowSec(), source: "default" };
}

let state: VenueModeState = fromEnv();
let loaded: Promise<VenueModeState> | null = null;

/** Reads the audit log once per process (a log row wins over `VENUE_MODE`); safe to call from every actor's start. */
export function loadVenueMode(log: (why: string) => void): Promise<VenueModeState> {
  loaded ??= (async () => {
    const db = getDb();
    if (db) {
      await ensureSchema();
      const row = await latestVenueMode(db);
      if (row) state = { ...row, source: "log" };
    }
    log(`venue mode ${state.mode}${state.reason ? ` (${state.reason})` : ""}, from the ${state.source === "log" ? "audit log" : state.source === "env" ? "environment" : "default"}`);
    return state;
  })().catch((error: unknown) => {
    loaded = null;
    throw error;
  });
  return loaded;
}

export const venueMode = (): VenueModeState => state;

/** Null when `action` may proceed now; otherwise the refusal's words for the caller's `market-not-trading` answer. */
export const venueModeRefusalNow = (action: VenueModeAction): string | null => venueModeRefusal(state.mode, action, state.reason);

/** Records the change in the audit log first (when there is one), then applies it: a mode nobody can read back is not set. */
export async function setVenueMode(mode: VenueModeName, reason: string | null, setBy: string): Promise<VenueModeState> {
  const next: VenueModeState = { mode, reason, setBy, setAtSec: nowSec(), source: "log" };
  const db = getDb();
  if (db) {
    await ensureSchema();
    await recordVenueMode(db, { mode, reason, setBy, setAtSec: next.setAtSec });
  } else next.source = "env";
  state = next;
  return state;
}

/** Tests only: back to the boot state. */
export function resetVenueModeForTests(next: VenueModeState = fromEnv()): void {
  state = next;
  loaded = null;
}
