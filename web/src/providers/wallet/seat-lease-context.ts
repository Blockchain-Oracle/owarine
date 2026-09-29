"use client";

import type { SeatLeaseView } from "@agari/markets";
import { createContext, useContext } from "react";

/**
 * The server's half of a seat (plan §4) as every surface reads it: the lease `/api/seat` answered, with no key or
 * storage import. The web's `WalletShellProvider` and the phone's `SeatProvider` both fill it, from the same
 * `useSeatLeaseController`.
 *
 * - `view`: null until the first answer; then `leased`, `pool-full` (this page keeps its place and retries),
 *   `none` (a key with no lease: an expired one, or a fresh browser), `not-live` or `refused`.
 * - `closing`: the seat that was just reset still had open calls, so the server drains it before it goes back
 *   to the pool. Shown once, as the draining plate, until dismissed.
 */
export interface SeatLeaseState {
  view: SeatLeaseView | null;
  /** A lease request (the explicit "Take a Seat" click, a pool-full retry or "Lease it again") is in flight. */
  leasing: boolean;
  closing: { openCalls: number; atMs: number | null } | null;
  /** Ask for (or renew) this seat's lease: only ever from a click, never on page load. */
  lease(): Promise<SeatLeaseView | null>;
  dismissClosing(): void;
}

export const NO_LEASE: SeatLeaseState = {
  view: null,
  leasing: false,
  closing: null,
  lease: async () => null,
  dismissClosing: () => undefined,
};

export const SeatLeaseContext = createContext<SeatLeaseState>(NO_LEASE);

export function useSeatLeaseState(): SeatLeaseState {
  return useContext(SeatLeaseContext);
}

/** The leased view, or null for every other state. */
export type LeasedSeat = Extract<SeatLeaseView, { kind: "leased" }>;

export function leasedOf(view: SeatLeaseView | null): LeasedSeat | null {
  return view?.kind === "leased" ? view : null;
}

/**
 * `address` only while this browser holds a lease on that seat, else null (C4c.2). A seat's own index rows
 * (`/api/index/wallet/<address>/…`) answer 403 without a lease, so a read of them waits for one instead of polling a
 * refusal: a key restored from storage with an expired lease is not a seat yet.
 */
export function leasedAddressOf<A extends string>(view: SeatLeaseView | null, address: A | null): A | null {
  const leased = leasedOf(view);
  return leased !== null && address !== null && leased.address === address ? address : null;
}

/**
 * The seat's number from its party hint (`seat-3::1220…` → 3), or null when the hint carries none. The number is a
 * label for the menu; the party id beside it is the fact.
 */
export function seatNumberOf(party: string): number | null {
  const hint = party.split("::")[0] ?? "";
  const match = /^seat[-_]?(\d+)$/i.exec(hint);
  return match ? Number(match[1]) : null;
}
