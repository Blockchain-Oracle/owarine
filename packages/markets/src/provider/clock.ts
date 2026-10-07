import type { ClockSync } from "@owarine/core/types";
import { msToSec } from "@owarine/core/units";

let offsetMs = 0;
let lastSync: ClockSync | null = null;

/** Ledger-offset-corrected wall clock (device time until the ledger clock lands, C4). */
export function nowMs(): number {
  return Date.now() + offsetMs;
}

export function nowSec(): number {
  return msToSec(nowMs());
}

export function applyClockSync(sync: ClockSync): void {
  offsetMs = sync.offsetMs;
  lastSync = sync;
}

export function lastClockSync(): ClockSync | null {
  return lastSync;
}
