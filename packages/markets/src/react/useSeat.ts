"use client";

import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { useQuery } from "@tanstack/react-query";
import type { OpenQuote } from "../provider/ledger-wire";
import { readSeatLease, type SeatLeaseView } from "../provider/seat";
import { listOpenQuotes } from "../provider/wallet";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

/** The seat's open firm quotes: the price the ticket is holding, with its `validUntilMs` for the 20 s ring (K-010a). */
export function useOpenQuotes(wallet: Address | null): Reading<OpenQuote[]> | null {
  return useReadingQuery(keys.openQuotes(wallet), () => listOpenQuotes(wallet as Address), { pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/**
 * The lease this browser holds (`GET /api/seat`), renewed by reading it: a visible tab keeps its seat alive every
 * minute; a backgrounded one stops, and the idle clock (paused while a leg is open) takes over.
 */
export function useSeatLease(enabled = true) {
  return useQuery<SeatLeaseView>({
    queryKey: keys.seatLease(),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 0,
    queryFn: async () => {
      const r = await readSeatLease();
      return r.ok ? r.value : { kind: "refused", diagnosis: r.diagnosis };
    },
  });
}
