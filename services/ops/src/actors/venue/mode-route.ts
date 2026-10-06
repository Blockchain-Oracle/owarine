/**
 * `POST /internal/admin/venue-mode` (C-DAML-02, the reference's `admin_set_mode`): signed with `OPS_ADMIN_SECRET`, closed
 * without it. `{}` reads the mode; `{ mode, reason }` sets it (`open`, `reduce-only`, `paused`), writing the audit log
 * first. The answer is the mode now, so the caller sees what new risk will meet.
 */
import { isVenueMode } from "@agari/core/market";
import { diagnosis } from "@agari/core/types";
import type { InternalHandler } from "../../http/internal";
import { setVenueMode, venueMode } from "../../runtime/venue-mode";

export const OPS_VENUE_MODE_PATH = "/internal/admin/venue-mode";
const MAX_REASON = 160;

export function venueModeRoute(log: (why: string) => void): InternalHandler {
  return async (body) => {
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.mode === undefined) return { status: 200, body: { kind: "venue-mode", ...venueMode() } };
    if (!isVenueMode(b.mode)) return { status: 400, body: { diagnosis: diagnosis("unknown", "mode must be open, reduce-only or paused") } };
    const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, MAX_REASON) : null;
    const by = typeof b.by === "string" && b.by.trim() ? b.by.trim().slice(0, 64) : "operator";
    const before = venueMode().mode;
    const next = await setVenueMode(b.mode, reason, by);
    log(`venue mode ${before} → ${next.mode}${reason ? ` (${reason})` : ""} by ${by}${next.source === "log" ? ", recorded in venue_mode_log" : " (no database: not persisted)"}`);
    return { status: 200, body: { kind: "venue-mode", ...next } };
  };
}
