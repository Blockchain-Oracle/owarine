"use client";

import { err, ok, type Reading } from "@owarine/core";
import { readSeatPkg, type ExitWire, type SeatPkgReply, type TransferWire } from "@owarine/markets";
import { useReadingQuery } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { leasedOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";

/** Exits fill and transfers arrive without the seat doing anything: a few seconds' poll keeps the screen honest. */
const POLL_MS = 4_000;
export const seatPkgKey = (party: string | null) => ["owarine", "seat-pkg", party] as const;

export interface SeatPkgState {
  /** False until the R2 DAR is on the participant (or while there is no leased seat): Trail stays in the tab. */
  deployed: boolean;
  exits: readonly ExitWire[];
  transfers: readonly TransferWire[];
  /** The seat's own party id: what another seat sends to. */
  party: string | null;
  exitFor: (marketId: string, side: "up" | "down") => ExitWire | null;
  refresh: () => Promise<void>;
}

/**
 * The leased seat's abu-pm-seat view (R2): its resting exits and open transfers, read from the ledger as the seat. The
 * terminal (Trail, TP/SL, Close through an exit) and the account sheet (Send, incoming credits) share one read.
 */
export function useSeatPkg(enabled = true): SeatPkgState {
  const lease = useSeatLeaseState();
  const party = leasedOf(lease.view)?.party ?? null;
  const queryClient = useQueryClient();
  const reading = useReadingQuery<SeatPkgReply>(
    seatPkgKey(party),
    async (): Promise<Reading<SeatPkgReply>> => {
      const r = await readSeatPkg();
      return r.ok ? ok(r.value, Date.now()) : err(r.diagnosis);
    },
    { pollMs: POLL_MS, enabled: enabled && party !== null, needs: [] },
  );
  const view = reading && reading.ok ? reading.value : null;
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: seatPkgKey(party) }), [queryClient, party]);
  return useMemo(() => {
    const exits = view?.exits ?? [];
    return {
      deployed: view?.deployed ?? false,
      exits,
      transfers: view?.transfers ?? [],
      party,
      exitFor: (marketId, side) => exits.find((x) => x.marketId === marketId && x.side === side) ?? null,
      refresh,
    };
  }, [view, party, refresh]);
}
