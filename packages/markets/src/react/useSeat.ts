"use client";

import { MARKETS_POLL_MS } from "@owarine/core/constants";
import type { Reading } from "@owarine/core/schemas";
import type { Address } from "@owarine/core/types";
import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ledgerRequest } from "../provider/ledger-api";
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

/** Whose view of the ledger `/api/view` reads: the caller's own leased seat, or a reserved demo persona. */
export type LedgerViewAs = "me" | "alice" | "bob" | "outsider";

/** `/api/view`'s answer: the rows the participant returned for that party, and the literal request body it was sent. */
export const ledgerViewWire = z.object({
  as: z.string(),
  party: z.string(),
  /** The literal `POST /v2/state/active-contracts-page` body (minus paging), party id and all. */
  request: z.object({ eventFormat: z.unknown() }),
  activeAtOffset: z.number(),
  rows: z.array(z.object({ template: z.string(), contractId: z.string(), signatories: z.array(z.string()), observers: z.array(z.string()), payload: z.unknown() })),
  total: z.number(),
  note: z.string(),
});
export type LedgerView = z.output<typeof ledgerViewWire>;
export type LedgerViewResult = { ok: true; value: LedgerView } | { ok: false; technical: string; kind: string };

const VIEW_STALE_MS = 5_000;

/**
 * The per-party view switcher's reads (plan §5): one live active-contracts query per party, at the same moment. Never
 * polled: a tab's panel is the ledger's answer at the time it was asked, and "Ask again" refetches.
 */
export function useLedgerViews(parties: readonly LedgerViewAs[]) {
  return useQueries({
    queries: parties.map((as) => ({
      queryKey: [...keys.seatLease(), "view", as] as const,
      staleTime: VIEW_STALE_MS,
      retry: 0,
      queryFn: async (): Promise<LedgerViewResult> => {
        const r = await ledgerRequest("/view", { method: "GET", root: true, query: { as }, wire: ledgerViewWire });
        return r.ok ? { ok: true, value: r.value } : { ok: false, technical: r.diagnosis.technical, kind: r.diagnosis.kind };
      },
    })),
  });
}
