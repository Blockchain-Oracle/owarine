"use client";

import { CC_RAIL_CAPABILITY } from "@agari/core/cc";
import { diagnosis, err, ok, type Reading } from "@agari/core";
import { postCcDeposit, postCcWithdraw, readCcRail, type CcRailReply, type CcWriteReply } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";
import { useCallback, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { leasedOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { ccPanel, type CcPanel } from "./cc-panel";

/** The server answers from the ledger; a minute-old figure is fine, and nothing polls while the path is not live. */
const POLL_MS = 15_000;
const ccKey = (party: string | null) => ["agari", "funding", "cc", party] as const;

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
}

const describe = (r: CcWriteReply, ok: string, failed: string): { tone: "ok" | "err"; text: string } =>
  r.kind === "requested" ? { tone: "ok", text: ok } : { tone: "err", text: r.kind === "refused" ? r.diagnosis.technical || failed : failed };

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
  const run = useCallback(async (call: () => ReturnType<typeof postCcDeposit>, okText: string, failText: string) => {
    setBusy(true);
    try {
      const r = await call();
      setNotice(r.ok ? describe(r.value, okText, failText) : { tone: "err", text: r.diagnosis.technical || failText });
    } catch {
      setNotice({ tone: "err", text: failText });
    } finally {
      setBusy(false);
    }
  }, []);
  return {
    panel: ccPanel({ capability: CC_RAIL_CAPABILITY, view }),
    view,
    loading: live && reading === null,
    readError: live && reading && !reading.ok ? diagnosis("unknown", reading.error.technical).technical : null,
    busy,
    notice,
    deposit: (amount) => run(() => postCcDeposit(amount), "Sent. The venue answers within a minute or so.", "That did not go through. Nothing moved."),
    withdraw: (units) => run(() => postCcWithdraw(units), "Sent. The venue answers within a minute or so.", "That did not go through. Nothing moved."),
  };
}
