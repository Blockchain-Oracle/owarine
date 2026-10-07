"use client";

import { privateBalanceReplyWire, type PrivateBalanceReply } from "@owarine/core/private";
import { err, ok, type Reading } from "@owarine/core/schemas";
import { ledgerRequest } from "@owarine/markets";
import { useReadingQuery } from "@owarine/markets/react";

const POLL_MS = 15_000;

async function readPositions(): Promise<Reading<PrivateBalanceReply>> {
  const r = await ledgerRequest("/private/balance", { method: "GET", wire: privateBalanceReplyWire, root: true });
  return r.ok ? ok(r.value, Date.now()) : err(r.diagnosis);
}

/** The seat's private bucket and its private calls under this lease (C8d, L-39): the ledger is the record, so this is the list. */
export function usePrivatePositions(address: string | null): Reading<PrivateBalanceReply> | null {
  return useReadingQuery(["owarine", "private", "positions", address ?? ""] as const, readPositions, { pollMs: POLL_MS, enabled: address !== null, needs: [] });
}
