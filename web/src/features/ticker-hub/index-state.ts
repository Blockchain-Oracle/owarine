/**
 * Whether a company's Pyth valuation index can be shown, and if not, why (S20, D-125, C8d). One pure reading of ops'
 * entitlement probe, shared by the pre-IPO bar, the valuation hub, `/dev/pyth-index` and the phone, so every surface
 * that leaves the index out says the same reason: the lane is listed only while the probe says the index is readable,
 * and its absence is explained, never silent.
 */
import type { Reading } from "@owarine/core";
import type { PreIpoSymbol } from "@owarine/core/market";
import { TICKER_HUB } from "./copy";
import type { PythIndexEntitlement, PythIndexRow, PythIndexView } from "./usePythIndex";

export type IndexState =
  | { kind: "readable"; row: PythIndexRow }
  /** `why` finishes "Pyth's valuation index is not shown: …"; `gate` is what it waits on (D-015). */
  | { kind: "absent"; why: string; gate: string; checkedAtSec: number | null };

const hhmm = (sec: number): string => new Date(sec * 1000).toISOString().slice(11, 16);

/** The reason one entitlement row gives for showing no index. */
export function absentWhy(entitlement: PythIndexEntitlement | undefined): string {
  const V = TICKER_HUB.valuation.why;
  if (!entitlement) return V.unknown;
  if (entitlement.state === "denied") return V.denied(entitlement.status, entitlement.reason, entitlement.checkedAtSec === null ? null : hhmm(entitlement.checkedAtSec));
  if (entitlement.state === "entitled") return V.noPrint;
  return entitlement.reason === "no PYTH_API_KEY" ? V.noKey : V.unknown;
}

/** Null while the first read is in flight; otherwise the index row, or the reason there is none. */
export function indexStateOf(reading: Reading<PythIndexView> | null, of: PreIpoSymbol): IndexState | null {
  if (reading === null) return null;
  const gate = TICKER_HUB.valuation.gate;
  if (!reading.ok) return { kind: "absent", why: TICKER_HUB.valuation.why.readFailed, gate, checkedAtSec: null };
  const row = reading.value.rows[of];
  if (row) return { kind: "readable", row };
  const entitlement = reading.value.entitlement[of];
  return { kind: "absent", why: absentWhy(entitlement), gate, checkedAtSec: entitlement?.checkedAtSec ?? null };
}
