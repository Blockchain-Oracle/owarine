"use client";

import { CC_RAIL_CAPABILITY } from "@owarine/core/cc";
import { diagnosisCopy } from "@owarine/core/copy";
import { err, ok, type Reading } from "@owarine/core";
import type { Diagnosis } from "@owarine/core/types";
import { postCcDeposit, postCcReceive, postCcTap, postCcWithdraw, readCcRail, type CcRailReply, type CcWriteReply } from "@owarine/markets";
import { useReadingQuery } from "@owarine/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { leasedOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { ccPanel, type CcPanel } from "./cc-panel";
import { FUNDING } from "./copy";

/** The server answers from the ledger; a minute-old figure is fine, and nothing polls while the path is not live. */
const POLL_MS = 15_000;
const ccKey = (party: string | null) => ["owarine", "funding", "cc", party] as const;

export interface CcRailState {
  panel: CcPanel;
  view: CcRailReply | null;
  /** True while the read has not answered (live only). */
  loading: boolean;
  /** The read's failure, when there is one (live only); the panel then shows what it can. */
  readError: string | null;
  busy: boolean;
  /** The last write's outcome in words, null before one. */
  notice: { tone: "ok" | "err"; text: string } | null;
  deposit: (amount: string) => Promise<void>;
  withdraw: (units: bigint) => Promise<void>;
  /** DevNet: tap the faucet's test coin into the seat. */
  tap: () => Promise<void>;
  /** Accept the coin the venue sent for a withdrawal. */
  receive: () => Promise<void>;
}

/**
 * The seat side refuses in its own sentences for these kinds (an amount that is not exact, coin or cash that does not
 * cover, an ask already waiting, the path not live); those are shown as written. Any other refusal is a ledger's or a
 * network's, whose technical text is for a report and never for a screen: it gets the shared headline.
 */
const OWN_WORDS = new Set<string>(["invalid-price", "insufficient-collateral", "grant-refused", "not-deployed", "market-not-trading"]);
const wordsOf = (d: Diagnosis, failed: string): string => (OWN_WORDS.has(d.kind) && d.technical ? d.technical : diagnosisCopy(d.kind).headline || failed);

const describe = (r: CcWriteReply, ok: string, failed: string): { tone: "ok" | "err"; text: string } =>
  r.kind === "requested" ? { tone: "ok", text: ok } : { tone: "err", text: wordsOf(r.diagnosis, failed) };

/**
 * The Canton Coin path for the funds screens (C7b). While `CC_RAIL_CAPABILITY` is not-live it reads nothing (there is no
 * one to ask, and asking would only invent an answer) and the panel says so; once live it reads `GET /api/ledger/cc` for the
 * leased seat and offers the writes. Web and phone share it: the seat proof rides `ledgerRequest`.
 */
export function useCcRail(): CcRailState {
  const { address } = useWalletSession();
  const lease = useSeatLeaseState();
  const leased = leasedOf(lease.view);
  const live = CC_RAIL_CAPABILITY === "live";
  const reading = useReadingQuery<CcRailReply>(
    ccKey(leased?.party ?? null),
    async (): Promise<Reading<CcRailReply>> => {
      const r = await readCcRail();
      return r.ok ? ok(r.value, Date.now()) : err(r.diagnosis);
    },
    { pollMs: POLL_MS, enabled: live && address !== null && leased !== null, needs: [] },
  );
  const view = reading && reading.ok ? reading.value : null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CcRailState["notice"]>(null);
  const queryClient = useQueryClient();
  const party = leased?.party ?? null;
  const run = useCallback(async (call: () => ReturnType<typeof postCcDeposit>, okText: string, failText: string) => {
    setBusy(true);
    try {
      const r = await call();
      setNotice(r.ok ? describe(r.value, okText, failText) : { tone: "err", text: wordsOf(r.diagnosis, failText) });
      // A landed write changed what the seat holds: read it now rather than at the next poll.
      if (r.ok && r.value.kind === "requested") void queryClient.invalidateQueries({ queryKey: ccKey(party) });
    } catch {
      setNotice({ tone: "err", text: failText });
    } finally {
      setBusy(false);
    }
  }, [queryClient, party]);
  return {
    panel: ccPanel({ capability: CC_RAIL_CAPABILITY, view }),
    view,
    loading: live && reading === null,
    readError: live && reading && !reading.ok ? diagnosisCopy(reading.error.kind).headline : null,
    busy,
    notice,
    deposit: (amount) => run(() => postCcDeposit(amount), "Sent. The venue answers within a minute or so.", "That did not go through. Nothing moved."),
    withdraw: (units) => run(() => postCcWithdraw(units), "Sent. The venue answers within a minute or so.", "That did not go through. Nothing moved."),
    tap: () => run(() => postCcTap(), FUNDING.cc.tapped, "That did not go through. Nothing moved."),
    receive: () => run(() => postCcReceive(), FUNDING.cc.received, "That did not go through. Nothing moved."),
  };
}
