"use client";

import { MARKETS_POLL_MS } from "@owarine/core/constants";
import { ok, type Reading } from "@owarine/core/schemas";
import type { Address, OnchainSnapshot } from "@owarine/core/types";
import { marketsProvider } from "@owarine/markets";
import { keys, useReadingQuery } from "@owarine/markets/react";
import { readSeat } from "@owarine/markets/runtime";

/**
 * What the next order must also fund beyond its escrow: the Series seat bond while the wallet has no seat on this
 * Window's Ledger (agari-events pulls it on the first order and refunds it at redeem). Read from the Ledger itself —
 * seat present or not, and the bond it records — the same read the order lane's funding check makes. Nested under the
 * wallet's positions, so the order that takes the seat clears it. Zero while unknown, closed, or off the wallet route.
 */
export function useSeatDeposit(wallet: Address | null, onchain: OnchainSnapshot | null): bigint {
  const ledger = onchain?.ledger ?? null;
  const reading = useReadingQuery<bigint>(
    [...keys.positions(wallet), "seat-deposit", ledger],
    async (): Promise<Reading<bigint>> => {
      const read = await readSeat(ledger as Address, wallet as Address);
      return ok(read && !read.seat ? read.seatBond : 0n, marketsProvider.nowMs());
    },
    { enabled: wallet !== null && ledger !== null, pollMs: MARKETS_POLL_MS },
  );
  return reading?.ok ? reading.value : 0n;
}
