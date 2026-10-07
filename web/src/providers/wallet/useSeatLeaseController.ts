"use client";

import type { Cluster } from "@owarine/core/constants";
import { leaseSeat, registerSeatSigner, releaseSeat, type SeatLeaseView } from "@owarine/markets";
import { keys, useSeatLease } from "@owarine/markets/react";
import type { SeatSigner } from "@owarine/markets/sessions";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeatLeaseState } from "./seat-lease-context";

/** A full pool is asked again on this cadence while the page is open: well under the route's 12 leases a minute. */
export const POOL_RETRY_MS = 15_000;

export interface SeatLeaseController extends SeatLeaseState {
  /** Lease for a seat key that was only just made (the take flow runs before the signer reaches this hook's props). */
  leaseWith(signer: SeatSigner): Promise<SeatLeaseView | null>;
  /** "Reset seat": the server drains the seat; open calls are named once in the draining plate. */
  release(): Promise<void>;
}

const refusedView = (r: Awaited<ReturnType<typeof leaseSeat>>): SeatLeaseView => (r.ok ? r.value : { kind: "refused", diagnosis: r.diagnosis });

/**
 * The lease half of a seat, shared by the web shell and the phone's SeatProvider. It reads `/api/seat` (the read
 * renews it while the tab is visible), takes a lease only when asked (the "Take a Seat" click, "Lease it again", and
 * the pool-full retry the reader started with that click), and lets it go on "Reset seat".
 */
export function useSeatLeaseController({ signer, cluster }: { signer: SeatSigner | null; cluster: Cluster }): SeatLeaseController {
  const queryClient = useQueryClient();
  const [leasing, setLeasing] = useState(false);
  const [closing, setClosing] = useState<SeatLeaseState["closing"]>(null);
  const inFlight = useRef<Promise<SeatLeaseView | null> | null>(null);
  /**
   * The last pool-full answer while this page waits in line. A lease read (`GET /api/seat`) answers "none" for a seat
   * that holds no lease yet, which must not end the wait: only a lease, a refusal or a reset does.
   */
  const [waiting, setWaiting] = useState<Extract<SeatLeaseView, { kind: "pool-full" }> | null>(null);

  // The phone proves its seat with the signed read header; register the key before the first read goes out.
  useEffect(() => {
    if (signer) registerSeatSigner({ address: signer.address, signMessage: (bytes) => signer.signMessage(bytes) });
  }, [signer]);

  const query = useSeatLease(signer !== null);
  const read = signer === null ? null : (query.data ?? null);
  const view = waiting && (read === null || read.kind === "none") ? waiting : read;

  const leaseWith = useCallback(
    (key: SeatSigner) => {
      if (inFlight.current) return inFlight.current;
      setLeasing(true);
      const run = (async () => {
        try {
          const next = refusedView(await leaseSeat(key, cluster));
          setWaiting(next.kind === "pool-full" ? next : null);
          queryClient.setQueryData(keys.seatLease(), next);
          return next;
        } finally {
          inFlight.current = null;
          setLeasing(false);
        }
      })();
      inFlight.current = run;
      return run;
    },
    [cluster, queryClient],
  );

  const lease = useCallback(async () => (signer ? leaseWith(signer) : null), [signer, leaseWith]);

  // Pool full: the reader already asked; keep their place by asking again until a seat frees.
  useEffect(() => {
    if (view?.kind !== "pool-full" || !signer) return;
    const timer = setTimeout(() => void leaseWith(signer), POOL_RETRY_MS);
    return () => clearTimeout(timer);
  }, [view, signer, leaseWith]);

  const release = useCallback(async () => {
    const held = view?.kind === "leased" ? view : null;
    setWaiting(null);
    if (held) await releaseSeat();
    queryClient.setQueryData<SeatLeaseView>(keys.seatLease(), { kind: "none" });
    if (held && held.openLegs > 0) setClosing({ openCalls: held.openLegs, atMs: null });
  }, [view, queryClient]);

  const dismissClosing = useCallback(() => setClosing(null), []);

  return useMemo(
    () => ({ view, leasing, closing, lease, leaseWith, release, dismissClosing }),
    [view, leasing, closing, lease, leaseWith, release, dismissClosing],
  );
}
